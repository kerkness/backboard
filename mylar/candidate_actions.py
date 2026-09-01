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

"""Acting on a search candidate the matcher rejected.

Fork-local (see FORK.md). These downloads deliberately bypass the matcher, which
is also the thing that stops Mylar filing a wrong file into a series folder. Two
guards follow from that:

  * the download is queued with **issueid=None**, so nothing downstream can
    auto-file it against the issue whose search happened to surface it, even if
    the staging flag below were somehow lost;
  * `queues/ddl.py` diverts the finished download into the staging folder and
    skips post-processing entirely.

Provenance lives in `search_candidates.ddl_id` rather than in `ddl_info`.
"""

import os
import shutil
import uuid

import mylar
from mylar import db, logger


def staging_root():
    """Where user-chosen downloads land. Never auto-processed."""
    root = mylar.CONFIG.CANDIDATE_FOLDER
    if not root:
        base = mylar.CONFIG.DDL_LOCATION or mylar.CONFIG.CACHE_DIR
        root = os.path.join(base, 'candidates')
    if not os.path.isdir(root):
        try:
            os.makedirs(root)
        except OSError as e:
            logger.warn('[CANDIDATE] cannot create staging folder %s: %s' % (root, e))
            return None
    return root


def get(run_id, seq):
    """Return (candidate, run) for a candidate, or (None, None)."""
    myDB = db.DBConnection()
    candidate = myDB.selectone(
        'SELECT * FROM search_candidates WHERE run_id=? AND seq=?', [run_id, seq]
    ).fetchone()
    if candidate is None:
        return None, None
    run = myDB.selectone('SELECT * FROM search_runs WHERE run_id=?', [run_id]).fetchone()
    return candidate, run


def set_action(run_id, seq, action, detail=None, ddl_id=None):
    values = {'action': action, 'action_detail': detail}
    if ddl_id is not None:
        values['ddl_id'] = ddl_id
    db.DBConnection().upsert(
        'search_candidates', values, {'run_id': run_id, 'seq': int(seq)}
    )


def ignore(run_id, seq, ignored=True):
    set_action(run_id, seq, 'ignored' if ignored else None,
               'dismissed by user' if ignored else None)
    return {'action': 'ignored' if ignored else None}


def download(run_id, seq, oneoff=False):
    """Hand a candidate's GetComics posting to the DDL queue, staged.

    Mirrors search.py:3176 -- GetComics needs the post page resolved into real
    host links before anything can be queued. zip_zip() already unpacks a .zip
    download, so a pack arrives as a folder without extra work here.
    """
    candidate, run = get(run_id, seq)
    if candidate is None:
        return {'success': False, 'message': 'No such candidate.'}
    if not candidate['link']:
        return {'success': False, 'message': 'That candidate has no download link.'}
    if staging_root() is None:
        return {'success': False, 'message': 'Staging folder is not writable.'}

    from mylar import getcomics

    ddl_id = uuid.uuid4().hex[:12]
    is_pack = bool(candidate['pack'])

    comicinfo = [{
        'ComicID': None,
        'IssueID': None,
        'booktype': (run['booktype'] if run else None),
        'nzbtitle': candidate['title'],
        'oneoff': oneoff,
        'pack': is_pack,
        # Read back in queues/ddl.py; comicinfo rides along in the queue payload,
        # so this needs no change to getcomics.py.
        'candidate_stage': True,
        'candidate_run': run_id,
        'candidate_seq': int(seq),
        'candidate_title': candidate['title'],
    }]
    packinfo = {'pack': is_pack, 'pack_numbers': None, 'pack_issuelist': None}

    try:
        ggc = getcomics.GC(issueid=None, comicid=None, oneoff=oneoff)
        ggc.loadsite(ddl_id, candidate['link'])
        result = ggc.parse_downloadresults(ddl_id, candidate['link'], comicinfo, packinfo)
    except Exception as e:
        logger.warn('[CANDIDATE] download failed for %s: %s' % (candidate['title'], e))
        set_action(run_id, seq, 'failed', str(e)[:400])
        return {'success': False, 'message': 'Could not queue: %s' % e}

    if not result or result is True or not isinstance(result, dict) or not result.get('success'):
        set_action(run_id, seq, 'failed', 'no usable download link on the posting')
        return {
            'success': False,
            'message': 'GetComics returned no usable download link for that posting.',
        }

    set_action(run_id, seq, 'downloading',
               'queued as one-shot' if oneoff else 'queued', ddl_id)
    return {
        'success': True,
        'ddl_id': ddl_id,
        'pack': is_pack,
        'message': 'Queued "%s" — it will land in %s' % (
            (candidate['title'] or '')[:80], staging_root()
        ),
    }


def stage(item, ddzstat):
    """Move a finished candidate download into staging instead of post-processing.

    Called from queues/ddl.py. Returns True when the item was handled here, so the
    caller knows to skip PP_QUEUE.
    """
    try:
        info = (item.get('comicinfo') or [{}])[0]
    except Exception:
        return False
    if not info.get('candidate_stage'):
        return False

    root = staging_root()
    src = ddzstat.get('path')
    if not root or not src or not os.path.exists(src):
        logger.warn('[CANDIDATE] nothing to stage for %s' % info.get('candidate_title'))
        return True

    name = os.path.basename(os.path.normpath(src)) or 'candidate-%s' % item.get('id')
    dst = os.path.join(root, name)
    n = 1
    while os.path.exists(dst):
        dst = os.path.join(root, '%s (%d)' % (name, n))
        n += 1

    try:
        shutil.move(src, dst)
        logger.info('[CANDIDATE] staged %s for manual review at %s' % (name, dst))
        state, detail = 'downloaded', dst
    except Exception as e:
        logger.warn('[CANDIDATE] unable to stage %s: %s' % (src, e))
        state, detail = 'failed', 'download succeeded but staging failed: %s' % e

    # Own the ddl_info bookkeeping rather than relying on whichever link attempt
    # won: the fallback chain can leave the row at 'Downloading' after a later
    # link type fails, which reads as a stalled download to the healthcheck and
    # the Activity screen.
    try:
        db.DBConnection().upsert(
            'ddl_info',
            {'status': 'Completed' if state == 'downloaded' else 'Failed'},
            {'id': item.get('id')},
        )
    except Exception as e:
        logger.warn('[CANDIDATE] unable to settle ddl_info status: %s' % e)

    try:
        set_action(info['candidate_run'], info['candidate_seq'], state, detail)
    except Exception as e:
        logger.warn('[CANDIDATE] unable to record staging result: %s' % e)
    return True
