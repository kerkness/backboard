# -*- coding: utf-8 -*-
#  This file is part of Mylar.
#
#  Mylar is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License, or
#  (at your option) any later version.
#
#  Mylar is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with Mylar.  If not, see <http://www.gnu.org/licenses/>.

"""Records what post-processing did with a download.

Fork-local (see FORK.md). Mylar decides each file's fate -- filed, duplicate,
failed -- and reports it only to the log. When a pack turns out to contain
issues you already own, nothing surfaces that: the download completes, the
issues stay Snatched, and the evidence scrolls past in mylar.log.

Anchored in PostProcessor.Process() rather than process.py, because PostProcessor
runs on its own thread and a thread-local set upstream would not be visible here.
The download is correlated by filename against ddl_info, since download_info stops
at process.py and does not reach PostProcessor.
"""

import os
import threading
import time
import uuid

from mylar import db, logger

_local = threading.local()


def _run():
    return getattr(_local, 'run', None)


def _resolve_ddl(nzb_name, nzb_folder):
    """Best-effort match back to the ddl_info row this came from."""
    try:
        myDB = db.DBConnection()
        base = os.path.basename(os.path.normpath(nzb_folder or '')) or None
        for value in (nzb_name, base):
            if not value:
                continue
            row = myDB.selectone(
                'SELECT id, series, issues FROM ddl_info'
                ' WHERE filename=? OR ? LIKE filename || "%"'
                ' ORDER BY submit_date DESC', [value, value]
            ).fetchone()
            if row:
                return row['id'], row['series'], row['issues']
    except Exception as e:
        logger.warn('[PP-AUDIT] unable to correlate download: %s' % e)
    return None, None, None


def start(nzb_name, nzb_folder, comicid=None, issueid=None):
    try:
        ddl_id, series, issues = _resolve_ddl(nzb_name, nzb_folder)
        _local.run = {
            'pp_id': uuid.uuid4().hex,
            'ddl_id': ddl_id,
            'ddl_series': series,
            'ddl_issues': issues,
            'nzb_name': nzb_name,
            'nzb_folder': nzb_folder,
            'comicid': str(comicid) if comicid else None,
            'issueid': str(issueid) if issueid else None,
            'started': time.time(),
            'files': [],
        }
    except Exception as e:
        logger.warn('[PP-AUDIT] unable to start: %s' % e)


def record(filename, outcome, detail=None, issuenumber=None):
    """Note what happened to one file. outcome: filed | duplicate | failed."""
    run = _run()
    if run is None:
        return
    try:
        run['files'].append({
            'filename': os.path.basename(filename) if filename else None,
            'outcome': outcome,
            'detail': str(detail)[:400] if detail is not None else None,
            'issuenumber': str(issuenumber) if issuenumber is not None else None,
        })
    except Exception as e:
        logger.warn('[PP-AUDIT] unable to record file: %s' % e)


def note_filed(count, failed=0):
    """How many issues post-processing actually filed, from its own tally."""
    run = _run()
    if run is None:
        return
    try:
        run['filed_reported'] = int(count)
        run['failed_reported'] = int(failed or 0)
    except (TypeError, ValueError):
        pass


def finish(status='complete', filed=None):
    run = _run()
    _local.run = None
    if run is None:
        return
    if not run['files'] and not run.get('filed_reported'):
        return

    counts = {'filed': 0, 'duplicate': 0, 'failed': 0}
    for f in run['files']:
        counts[f['outcome']] = counts.get(f['outcome'], 0) + 1
    # Mylar's own tally counts every issue it walked, duplicates included -- the
    # InSEXts pack reported "8 issues" when all 8 were already owned. Derive the
    # genuinely-filed count rather than trusting that number directly.
    if run.get('failed_reported'):
        counts['failed'] = max(counts['failed'], int(run['failed_reported']))
    reported = run.get('filed_reported') or filed
    total = int(reported) if reported else len(run['files'])
    counts['filed'] = max(0, total - counts['duplicate'] - counts['failed'])

    try:
        myDB = db.DBConnection()
        myDB.upsert(
            'pp_runs',
            {
                'ddl_id': run['ddl_id'],
                'ddl_series': run['ddl_series'],
                'ddl_issues': run['ddl_issues'],
                'nzb_name': run['nzb_name'],
                'nzb_folder': run['nzb_folder'],
                'comicid': run['comicid'],
                'issueid': run['issueid'],
                'started': run['started'],
                'finished': time.time(),
                'status': status,
                'files_total': total,
                'filed_count': counts['filed'],
                'duplicate_count': counts['duplicate'],
                'failed_count': counts['failed'],
            },
            {'pp_id': run['pp_id']},
        )
        for n, f in enumerate(run['files'], 1):
            myDB.upsert(
                'pp_files',
                {
                    'filename': f['filename'],
                    'outcome': f['outcome'],
                    'detail': f['detail'],
                    'issuenumber': f['issuenumber'],
                },
                {'pp_id': run['pp_id'], 'seq': n},
            )
        logger.info(
            '[PP-AUDIT] %s: %s filed, %s duplicate, %s failed'
            % (run['nzb_name'], counts['filed'], counts['duplicate'], counts['failed'])
        )
    except Exception as e:
        logger.warn('[PP-AUDIT] unable to persist: %s' % e)
