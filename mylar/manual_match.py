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

"""File one specific file as one specific issue, on the user's say-so.

Fork-local (see FORK.md). `PostProcessor.Process()` re-derives identity from the
filename even when handed an issueid, and will veto a match it disagrees with --
a GetComics pack labelled `100 Bullets 014 (2001)` is refused because ComicVine
dates issue 14 to 2000-07-05. For an automatic match that caution is right; for a
manual one it defeats the point.

`Process_next()` is the half that does the actual work -- naming, moving,
metadata, and the database update -- and takes the identity as given. This calls
it directly, skipping the matching half only.
"""

import os
import queue as _queue

import mylar
from mylar import db, logger


def run(path, issueid, comicid):
    """Post-process `path` as the given issue. Returns a result dict."""
    if not path or not os.path.isfile(path):
        return {'success': False, 'message': 'File no longer exists: %s' % path}

    myDB = db.DBConnection()
    issue = myDB.selectone(
        'SELECT Issue_Number, ComicName FROM issues WHERE IssueID=? AND ComicID=?',
        [issueid, comicid]
    ).fetchone()
    annual = False
    if issue is None:
        issue = myDB.selectone(
            'SELECT Issue_Number, ReleaseComicName AS ComicName FROM annuals'
            ' WHERE IssueID=? AND ComicID=? AND NOT Deleted', [issueid, comicid]
        ).fetchone()
        annual = True
    if issue is None:
        return {'success': False, 'message': 'No such issue %s in series %s'
                                             % (issueid, comicid)}

    ppqueue = _queue.Queue()
    try:
        pp = mylar.PostProcessor.PostProcessor(
            os.path.basename(path),
            os.path.dirname(path),
            issueid,
            queue=ppqueue,
            comicid=comicid,
            apicall=True,
        )
    except Exception as e:
        logger.error('[MANUAL-MATCH] could not start post-processing: %s' % e)
        return {'success': False, 'message': 'Could not start post-processing: %s' % e}

    logger.info(
        '[MANUAL-MATCH] Filing "%s" as %s issue %s (asserted by user).'
        % (os.path.basename(path), issue['ComicName'], issue['Issue_Number'])
    )
    try:
        # Process_next reads five keys off ml. ForcedMatch=False keeps it from
        # trying to strip an [__issueid__] marker out of the filename, and a falsy
        # IssueArcID skips the story-arc branch -- this is a plain series issue.
        pp.Process_next(
            comicid, issueid, issue['Issue_Number'],
            ml={
                'ComicLocation': path,
                'ComicID': comicid,
                'IssueID': issueid,
                'IssueArcID': None,
                'ForcedMatch': False,
            },
        )
    except Exception as e:
        logger.error('[MANUAL-MATCH] post-processing failed: %s' % e)
        return {'success': False, 'message': 'Post-processing failed: %s' % e}
    finally:
        mylar.APILOCK = False

    # Process_next reports through the queue it was handed.
    outcome = None
    try:
        while not ppqueue.empty():
            outcome = ppqueue.get_nowait()
    except Exception:
        pass

    status = myDB.selectone(
        'SELECT Status FROM %s WHERE IssueID=?' % ('annuals' if annual else 'issues'),
        [issueid]
    ).fetchone()
    new_status = status['Status'] if status else None
    logger.info('[MANUAL-MATCH] %s issue %s is now %s'
                % (issue['ComicName'], issue['Issue_Number'], new_status))

    return {
        'success': new_status == 'Downloaded',
        'status': new_status,
        'outcome': str(outcome)[:300] if outcome else None,
        'message': 'Issue %s is now %s.' % (issue['Issue_Number'], new_status),
    }
