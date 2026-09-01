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

"""Records what a search actually asked a provider, and what came back.

Fork-local (see FORK.md). Mylar's matcher answers one question -- "is there a
result I can download?" -- and discards everything else: `_process_entry` returns
a bare None at 18 different rejection points, and `check_for_first_result` keeps
only the first accepted match. When a search finds nothing there is no record of
what was queried, what the provider returned, or why each result was turned down.

This module keeps that evidence so the UI can show it.

Runs are held per-thread while a search is in progress and flushed to the DB in
one transaction at the end, so a search doesn't hammer the database mid-loop --
DB locks are a known sore spot in this deployment.
"""

import threading
import time
import uuid

from mylar import db, logger

# Keep the tables from growing without bound; a search that walks 31 pages can
# produce a lot of rows.
MAX_RUNS_PER_ISSUE = 20
MAX_CANDIDATES_PER_RUN = 500

_local = threading.local()


def _run():
    return getattr(_local, 'run', None)


def start_run(comicid=None, issueid=None, comicname=None, issuenumber=None,
              seriesyear=None, booktype=None, provider=None):
    """Begin recording. Returns the run_id, or None if recording is unavailable."""
    try:
        _local.run = {
            'run_id': uuid.uuid4().hex,
            'comicid': str(comicid) if comicid is not None else None,
            'issueid': str(issueid) if issueid is not None else None,
            'comicname': comicname,
            'issuenumber': str(issuenumber) if issuenumber is not None else None,
            'seriesyear': str(seriesyear) if seriesyear is not None else None,
            'booktype': booktype,
            'provider': provider,
            'started': time.time(),
            'queries': [],
            'queryline': None,
            'candidates': [],
            'seq': 0,
        }
        return _local.run['run_id']
    except Exception as e:
        logger.warn('[SEARCH-AUDIT] unable to start run: %s' % e)
        return None


def record_query(queryline):
    """Note a query string actually sent to the provider."""
    run = _run()
    if run is None:
        return
    run['queryline'] = queryline
    if queryline not in run['queries']:
        run['queries'].append(queryline)


def record_candidate(entry):
    """Record a result the provider returned. Returns a seq to attach a verdict to."""
    run = _run()
    if run is None:
        return None
    if len(run['candidates']) >= MAX_CANDIDATES_PER_RUN:
        return None
    run['seq'] += 1
    try:
        run['candidates'].append({
            'seq': run['seq'],
            'queryline': run['queryline'],
            'title': entry.get('title'),
            'link': entry.get('link'),
            'size': entry.get('size'),
            'year': entry.get('year'),
            'issues': entry.get('issues'),
            'pack': 1 if entry.get('pack') else 0,
            'verdict': 'pending',
            'reason': None,
            'detail': None,
        })
    except Exception as e:
        logger.warn('[SEARCH-AUDIT] unable to record candidate: %s' % e)
        return None
    return run['seq']


def record_verdict(seq, verdict, reason=None, detail=None):
    """Attach the matcher's decision to a previously recorded candidate."""
    run = _run()
    if run is None or seq is None:
        return
    for c in run['candidates']:
        if c['seq'] == seq:
            c['verdict'] = verdict
            c['reason'] = reason
            c['detail'] = str(detail)[:500] if detail is not None else None
            break


def finish_run(status='complete', error=None):
    """Flush the run to the database and clear it. Safe to call twice."""
    run = _run()
    _local.run = None
    if run is None:
        return None

    accepted = len([c for c in run['candidates'] if c['verdict'] == 'accepted'])
    try:
        myDB = db.DBConnection()
        myDB.upsert(
            'search_runs',
            {
                'comicid': run['comicid'],
                'issueid': run['issueid'],
                'comicname': run['comicname'],
                'issuenumber': run['issuenumber'],
                'seriesyear': run['seriesyear'],
                'booktype': run['booktype'],
                'provider': run['provider'],
                'started': run['started'],
                'finished': time.time(),
                'status': status,
                'queries': '\n'.join(run['queries']),
                'candidate_count': len(run['candidates']),
                'accepted_count': accepted,
                'error': str(error)[:500] if error is not None else None,
            },
            {'run_id': run['run_id']},
        )
        for c in run['candidates']:
            myDB.upsert(
                'search_candidates',
                {
                    'queryline': c['queryline'],
                    'title': c['title'],
                    'link': c['link'],
                    'size': c['size'],
                    'year': c['year'],
                    'issues': c['issues'],
                    'pack': c['pack'],
                    'verdict': c['verdict'],
                    'reason': c['reason'],
                    'detail': c['detail'],
                },
                {'run_id': run['run_id'], 'seq': c['seq']},
            )
        _prune(myDB, run['issueid'])
        logger.fdebug(
            '[SEARCH-AUDIT] recorded run %s: %s candidate(s), %s accepted'
            % (run['run_id'], len(run['candidates']), accepted)
        )
    except Exception as e:
        logger.warn('[SEARCH-AUDIT] unable to persist run: %s' % e)
    return run['run_id']


def _prune(myDB, issueid):
    """Keep only the most recent runs for an issue."""
    if not issueid:
        return
    try:
        old = myDB.select(
            'SELECT run_id FROM search_runs WHERE issueid=? ORDER BY started DESC'
            ' LIMIT -1 OFFSET ?',
            [issueid, MAX_RUNS_PER_ISSUE],
        )
        for row in old:
            myDB.action('DELETE FROM search_candidates WHERE run_id=?', [row['run_id']])
            myDB.action('DELETE FROM search_runs WHERE run_id=?', [row['run_id']])
    except Exception as e:
        logger.warn('[SEARCH-AUDIT] prune failed: %s' % e)
