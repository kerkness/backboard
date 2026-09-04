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

"""Cover thumbnails for the weekly pull list.

The pull list is mostly series that aren't on the watchlist, so `cache/<comicid>.jpg`
(written when a series is added) covers only a fraction of it -- 14 of 80 rows in a
typical week here. The rest have a CV IssueID or ComicID and nothing else.

Fetching those one at a time is not viable: cv.pulldetails sleeps CVAPI_RATE (>=2s)
before every call and CV bans IPs that push past the hourly cap. So covers are
resolved a week at a time -- one metadata call per 100 ids -- and the images
themselves are pulled from CV's CDN, which takes no api_key and isn't metered.
"""

import io
import os
import threading

import requests
from PIL import Image

import mylar
from mylar import db, logger

# Thumbnail geometry matches _getFileCover so both look the same in a list.
THUMB = (320, 480)
# Second, larger copy for the click-to-zoom dialog. CV's own scale_large is
# 830x1280 / ~400KB; 640x960 fills an 85vh dialog at a third of the disk, and the
# list keeps loading the small one.
ZOOM = (640, 960)
SIZES = {'thumb': THUMB, 'zoom': ZOOM}
SUBDIR = 'pull_covers'

# Weeks currently being fetched, so a page refresh mid-fetch doesn't stack jobs.
_inflight = set()
_lock = threading.Lock()


def _cache_dir():
    path = os.path.join(mylar.CONFIG.CACHE_DIR, SUBDIR)
    os.makedirs(path, exist_ok=True)
    return path


def cover_path(issueid=None, comicid=None, size='thumb'):
    """Where one cached copy of a pull row's art lives, issue art preferred."""
    suffix = '' if size == 'thumb' else '@' + size
    if issueid:
        return os.path.join(_cache_dir(), 'i%s%s.jpg' % (issueid, suffix))
    if comicid:
        return os.path.join(_cache_dir(), 'v%s%s.jpg' % (comicid, suffix))
    return None


def _nocover_marker(issueid=None, comicid=None):
    """Marks an id ComicVine has no art for, so we stop re-asking every visit."""
    if issueid:
        return os.path.join(_cache_dir(), 'i%s.none' % issueid)
    if comicid:
        return os.path.join(_cache_dir(), 'v%s.none' % comicid)
    return None


def cached_cover(issueid=None, comicid=None, size='thumb'):
    """An existing cover for this row, or None. Never hits the network."""
    for ident in ({'issueid': issueid}, {'comicid': comicid}):
        if not any(ident.values()):
            continue
        path = cover_path(size=size, **ident)
        if path and os.path.isfile(path):
            return path
        # A row cached before the zoom copy existed still has its thumbnail;
        # showing that enlarged beats showing nothing.
        if size != 'thumb':
            path = cover_path(size='thumb', **ident)
            if path and os.path.isfile(path):
                return path

    # Series already on the watchlist have a full-size cover from when they were
    # added; reuse it rather than re-fetching the same art under a new name. It
    # is ~1280px tall, so it serves both sizes.
    if comicid:
        legacy = os.path.join(mylar.CONFIG.CACHE_DIR, '%s.jpg' % comicid)
        if os.path.isfile(legacy):
            return legacy
    return None


def _store(url, issueid=None, comicid=None):
    """Download one CV image once and write every size we serve."""
    try:
        r = requests.get(url, verify=mylar.CONFIG.CV_VERIFY,
                         headers=mylar.CV_HEADERS, timeout=30)
        r.raise_for_status()
        source = Image.open(io.BytesIO(r.content))
        if source.mode not in ('RGB', 'L'):
            source = source.convert('RGB')

        for size, box in SIZES.items():
            path = cover_path(issueid=issueid, comicid=comicid, size=size)
            img = source.copy()
            img.thumbnail(box, Image.LANCZOS)
            # Write via a temp name so a half-written file is never served.
            tmp = path + '.part'
            img.save(tmp, 'JPEG', quality=80)
            os.replace(tmp, path)
        return True
    except Exception as e:
        logger.fdebug('[PULL-COVERS] could not store %s: %s' % (url, e))
        return False


def _mark_missing(issueid=None, comicid=None):
    try:
        marker = _nocover_marker(issueid=issueid, comicid=comicid)
        if marker:
            open(marker, 'wb').close()
    except OSError:
        pass


def missing_for_week(week, year):
    """Pull rows for the week that have no cover cached yet.

    Returns (issueids, comicids) -- issue art where CV gave us an IssueID, and
    the series cover as a fallback for rows that only carry a ComicID.
    """
    myDB = db.DBConnection()
    rows = myDB.select(
        "SELECT ComicID, IssueID FROM weekly "
        "WHERE SUBSTR('0' || weeknumber, -2) = ? AND year = ? AND COMIC IS NOT NULL",
        [week, year]
    )

    issueids, comicids = [], []
    for row in rows:
        issueid = row['IssueID'] or None
        comicid = row['ComicID'] or None
        if not issueid and not comicid:
            continue
        marker = _nocover_marker(issueid=issueid, comicid=comicid)
        if marker and os.path.isfile(marker):
            continue
        if all(cached_cover(issueid=issueid, comicid=comicid, size=size)
               for size in SIZES):
            continue
        if issueid:
            issueids.append(issueid)
        else:
            comicids.append(comicid)

    return sorted(set(issueids)), sorted(set(comicids))


def _fetch(week, year):
    issueids, comicids = missing_for_week(week, year)
    stored = 0
    try:
        if issueids:
            images = mylar.cv.getComic(None, 'issue_images', comicidlist=issueids) or {}
            logger.fdebug('[PULL-COVERS] %s/%s: CV returned %s of %s issue covers'
                          % (year, week, len(images), len(issueids)))
            for issueid in issueids:
                url = images.get(str(issueid))
                if url and _store(url, issueid=issueid):
                    stored += 1
                elif images:
                    # CV answered but has no art for this one; don't ask again.
                    _mark_missing(issueid=issueid)

        if comicids:
            images = mylar.cv.getComic(None, 'volume_images', comicidlist=comicids) or {}
            logger.fdebug('[PULL-COVERS] %s/%s: CV returned %s of %s series covers'
                          % (year, week, len(images), len(comicids)))
            for comicid in comicids:
                url = images.get(str(comicid))
                if url and _store(url, comicid=comicid):
                    stored += 1
                elif images:
                    _mark_missing(comicid=comicid)

        logger.info('[PULL-COVERS] cached %s new covers for week %s of %s'
                    % (stored, week, year))
    except Exception as e:
        logger.warn('[PULL-COVERS] week %s of %s failed: %s' % (week, year, e))
    finally:
        with _lock:
            _inflight.discard((week, year))


def prefetch_week(week, year):
    """Kick off a background fetch for a week. Returns how many rows it will try.

    Safe to call on every page load: rows that already have art are skipped, so
    a fully-cached week does no work and makes no CV call at all.
    """
    issueids, comicids = missing_for_week(week, year)
    pending = len(issueids) + len(comicids)
    if not pending:
        return {'pending': 0, 'started': False}

    with _lock:
        if (week, year) in _inflight:
            return {'pending': pending, 'started': False}
        _inflight.add((week, year))

    threading.Thread(
        target=_fetch, args=(week, year),
        name='pull-covers-%s-%s' % (year, week), daemon=True
    ).start()
    return {'pending': pending, 'started': True}

# ---------------------------------------------------------------------------
# Series issue covers
#
# Unlike the weekly pull, these need no ComicVine call at all: issues.ImageURL is
# already populated for every issue on the watchlist. Mylar stores the
# scale_small variant, and CV's CDN serves the same image at other sizes from an
# interchangeable path segment, so the zoom copy is a string swap rather than a
# lookup. thumbnail() only ever shrinks, so a small source just stays small.
# ---------------------------------------------------------------------------

CV_SIZE_SEGMENTS = (
    'scale_avatar', 'square_avatar', 'scale_small', 'scale_medium', 'screen_medium',
)


def _largest_variant(url):
    """Point a stored CV image URL at the biggest rendition of the same image."""
    if not url:
        return url
    for segment in CV_SIZE_SEGMENTS:
        if '/%s/' % segment in url:
            return url.replace('/%s/' % segment, '/scale_large/', 1)
    return url


def missing_for_series(comicid):
    """Issues of this series with no cover cached yet, as [(issueid, url)]."""
    myDB = db.DBConnection()
    rows = myDB.select(
        'SELECT IssueID, ImageURL FROM issues WHERE ComicID=? AND IssueID IS NOT NULL',
        [comicid]
    )

    missing = []
    for row in rows:
        issueid, url = row['IssueID'], row['ImageURL']
        if not issueid or not url:
            continue
        marker = _nocover_marker(issueid=issueid)
        if marker and os.path.isfile(marker):
            continue
        if all(cached_cover(issueid=issueid, size=size) for size in SIZES):
            continue
        missing.append((issueid, url))
    return missing


def _fetch_series(comicid):
    stored = 0
    try:
        for issueid, url in missing_for_series(comicid):
            if _store(_largest_variant(url), issueid=issueid):
                stored += 1
            else:
                # The URL is on record but the image will not load; stop retrying.
                _mark_missing(issueid=issueid)
        logger.info('[PULL-COVERS] cached %s new issue covers for series %s'
                    % (stored, comicid))
    except Exception as e:
        logger.warn('[PULL-COVERS] series %s failed: %s' % (comicid, e))
    finally:
        with _lock:
            _inflight.discard(('series', comicid))


def prefetch_series(comicid):
    """Background-cache every issue cover for one series. Makes no CV API call."""
    pending = len(missing_for_series(comicid))
    if not pending:
        return {'pending': 0, 'started': False}

    with _lock:
        if ('series', comicid) in _inflight:
            return {'pending': pending, 'started': False}
        _inflight.add(('series', comicid))

    threading.Thread(
        target=_fetch_series, args=(comicid,),
        name='issue-covers-%s' % comicid, daemon=True
    ).start()
    return {'pending': pending, 'started': True}


def _fetch_results(pairs, token):
    stored = 0
    try:
        for comicid, url in pairs:
            if _store(_largest_variant(url), comicid=comicid):
                stored += 1
            else:
                _mark_missing(comicid=comicid)
        logger.fdebug('[PULL-COVERS] cached %s of %s lookup covers'
                      % (stored, len(pairs)))
    except Exception as e:
        logger.warn('[PULL-COVERS] lookup covers failed: %s' % e)
    finally:
        with _lock:
            _inflight.discard(token)


def prefetch_results(results):
    """Cache covers for a set of ComicVine search results.

    The search already handed us each series' image URL, so this costs no extra
    CV API call -- it just pulls the images off the CDN so the picker can serve
    them from Mylar rather than hotlinking ComicVine into the browser.
    """
    pairs = []
    for r in results or []:
        comicid, url = r.get('comicid'), r.get('comicimage')
        if not comicid or not url:
            continue
        marker = _nocover_marker(comicid=comicid)
        if marker and os.path.isfile(marker):
            continue
        if all(cached_cover(comicid=comicid, size=size) for size in SIZES):
            continue
        pairs.append((str(comicid), url))

    if not pairs:
        return {'pending': 0, 'started': False}

    token = ('lookup', tuple(sorted(c for c, _ in pairs)))
    with _lock:
        if token in _inflight:
            return {'pending': len(pairs), 'started': False}
        _inflight.add(token)

    threading.Thread(
        target=_fetch_results, args=(pairs, token),
        name='lookup-covers', daemon=True
    ).start()
    return {'pending': len(pairs), 'started': True}
