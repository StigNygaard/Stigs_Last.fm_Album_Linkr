// ==UserScript==
// @name            Stig's Last.fm Album Linkr
// @namespace       dk.rockland.userscript.lastfm.linkr
// @description     Adding album links and headers to tracks on Last.Fm's recent plays listings - plus linkifying About Me section on profiles
// @version         2019.03.01.1
// @author          Stig Nygaard, http://www.rockland.dk
// @homepageURL     http://www.rockland.dk/userscript/lastfm/linkr/
// @supportURL      http://www.rockland.dk/userscript/lastfm/linkr/
// @match           *://*.last.fm/*
// @match           *://*.lastfm.de/*
// @match           *://*.lastfm.es/*
// @match           *://*.lastfm.fr/*
// @match           *://*.lastfm.it/*
// @match           *://*.lastfm.ja/*
// @match           *://*.lastfm.pl/*
// @match           *://*.lastfm.pt/*
// @match           *://*.lastfm.ru/*
// @match           *://*.lastfm.sv/*
// @match           *://*.lastfm.tr/*
// @match           *://*.lastfm.zh/*
// @grant           GM_registerMenuCommand
// @grant           GM.getResourceUrl
// @grant           GM_getResourceURL
// @grant           GM_getValue
// @grant           GM_setValue
// @resource        albumIcon https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?url=http%3A%2F%2Fwww.rockland.dk%2Fimg%2Falbum244c.png&container=focus&resize_w=24&rewriteMime=image%2fpng&refresh=50000
// @require         https://greasyfork.org/scripts/34527/code/GMCommonAPI.js?version=237846
// @noframes
// ==/UserScript==

/*
 *      Stig's Last.fm Album Linkr is an userscript especially minded album-listeners on Last.Fm.
 *      It gives you better profile-pages with extra focus on albums in "recent tracks" lists.
 *
 *      https://greasyfork.org/scripts/21153-stig-s-last-fm-album-linkr
 *      https://github.com/StigNygaard/Stigs_Last.fm_Album_Linkr
 *      https://www.last.fm/user/rockland
 *
 *      Should work with all popular browsers and userscript managers. Compatibility with the new
 *      Greasemonkey 4 WebExtension and Firefox 57+ is done with the help of GM Common Library:
 *
 *      https://github.com/StigNygaard/GMCommonAPI.js
 *      https://greasyfork.org/scripts/34527-gmcommonapi-js
 */

var linkr = linkr || {
    // CHANGELOG - The most important updates/versions:
    changelog: [
        {version: '2019.03.01.1', description: "Remove extra (mobile ad?) line bubbling up in scrobbles list."},
        {version: '2019.02.23.0', description: "Update/fix for Collapse Top feature."},
        {version: '2018.09.13.0', description: "Minor code optimizations."},
        {version: '2018.01.06.0', description: "Making the Linkify-feature optional."},
        {version: '2017.12.13.0', description: "Fixing cover images in album-headers."},
        {version: '2017.10.26.1', description: "Now fully compatible with the upcoming Greasemonkey 4 WebExtension (Use webpage context-menu for options in GM4/Firefox)."},
        {version: '2017.08.07.0', description: "Separate links for short and long album titles ('Special Edition', 'Remastered' etc.)"},
        {version: '2017.08.01.1', description: "Moving development source to a GitHub repository: https://github.com/StigNygaard/Stigs_Last.fm_Album_Linkr"},
        {version: '2017.03.01.0', description: "Found a work-around to keep tapmusic collages working on secure https last.fm pages (https://carlo.zottmann.org/posts/2013/04/14/google-image-resizer.html)."},
        {version: '2017.02.28.0', description: "Fix for loading album-icon on secure (https) last.fm pages."},
        {version: '2016.11.05.3', description: "Another bonus-feature added: Optionally embed album collage from http://www.tapmusic.net/lastfm on user's profiles (Enable it via menu in the userscript browser extension)."},
        {version: '2016.10.26.0', description: 'More intelligent creation of links in album-headers when there are featured artists on some albumtracks.'},
        {version: '2016.10.19.0', description: 'Bonus-feature added: Linkifying URLs written in About Me section in Profiles.'},
        {version: '2016.07.04.0', description: '1st release.'}
    ],
    INFO: true,
    DEBUG: false,
    observed: null,
    linking_running: false,
    collagetype: '',
    collapseTop: false,
    linkifyEnabled: true,
    log: function(s, info) {
        if ((info && window.console) || (linkr.DEBUG && window.console)) {
            window.console.log('*Linkr* '+s);
        }
    },
    insertStyle: function() {
        if (!document.getElementById('linkrStyle')) {
            var style = document.createElement('style');
            style.type = 'text/css';
            style.id = 'linkrStyle';
            style.innerHTML = '#tapmusic {font-style:italic; font-size:12px; color:rgb(153,153,153)} .tapcollage {line-height:1.5; animation:fadein 15s; animation-timing-function:ease-in;} .tapcredit{line-height:1.3} @keyframes fadein {from{color:rgba(153,153,153,0);} to{color:rgba(153,153,153,1);}} ' +
                              'tr.albumlink-row,  tr.albumlink-row > td {background-color:#f1cccc !important} tr.albumlink-row > td.chartlist-name {font-style:italic} tr.albumlink-row > td.chartlist-name > span > span {font-style:normal} tr.albumlink-row:hover, tr.albumlink-row:hover > td {background-color:#f9d4d4 !important;} .albumextension, .albumextension .link-block-target {font-style:italic; color:#707070 !important} ' +
                              'tr.chartlist-row--interlist-ad.open-ad-container-mobile {display:none !important} ' +
                              (linkr.collapseTop ? 'div[id^="gpt-slot-"], #leader_top {display:none}' : '');
            document.getElementsByTagName('head')[0].appendChild(style);
            linkr.log('linkrStyle has been ADDED');
        } else {
            linkr.log('linkrStyle was already present');
        }
    },
    loadSettings: function() {
        linkr.collagetype = (String(GMC.getValue('collagetype', ''))); // tapmusic collage
        linkr.collapseTop = (String(GMC.getValue('collapseTop', 'false'))==='true');
        linkr.linkifyEnabled = (String(GMC.getValue('linkifyEnabled', 'true'))==='true');
    },
    saveSettings: function() {
        GMC.setValue('collagetype', String(linkr.collagetype));
        GMC.setValue('collapseTop', String(linkr.collapseTop));
        GMC.setValue('linkifyEnabled', String(linkr.linkifyEnabled));
        location.reload(true);
    },
    collageOff: function() {
        linkr.collagetype = '';
        linkr.saveSettings();
    },
    collage7day: function() {
        linkr.collagetype = '7day';
        linkr.saveSettings();
    },
    collage1month: function() {
        linkr.collagetype = '1month';
        linkr.saveSettings();
    },
    collage3month: function() {
        linkr.collagetype = '3month';
        linkr.saveSettings();
    },
    collage6month: function() {
        linkr.collagetype = '6month';
        linkr.saveSettings();
    },
    collage12month: function() {
        linkr.collagetype = '12month';
        linkr.saveSettings();
    },
    collageOverall: function() {
        linkr.collagetype = 'overall';
        linkr.saveSettings();
    },
    toggleCollapseTop: function() {
        linkr.collapseTop = !linkr.collapseTop;
        linkr.saveSettings();
    },
    toggleLinkifyEnabled: function() {
        linkr.linkifyEnabled = !linkr.linkifyEnabled;
        linkr.saveSettings();
    },
    linking: function (mutations) {
        if(linkr.linking_running) return;
        linkr.linking_running = true;
        function altvalue(elem) {
            if (elem && elem.firstElementChild) {
                if (elem.classList.contains('albumlink-row') || elem.firstElementChild.classList.contains('albumlink-row')) {
                    return null;
                } else if (elem.firstElementChild.firstElementChild && elem.firstElementChild.firstElementChild.firstElementChild && elem.firstElementChild.firstElementChild.firstElementChild.firstElementChild) {
                    return elem.firstElementChild.firstElementChild.firstElementChild.firstElementChild.alt;
                } else if (elem.firstElementChild.firstElementChild && elem.firstElementChild.firstElementChild.firstElementChild) {
                    return elem.firstElementChild.firstElementChild.firstElementChild.alt;
                }
            }
            return null;
        }
        function containing(s, sub) {
            s = s.trim().replace(/^the\s/gi, "").replace(/\,\sthe$/gi,"").replace(" & ", " and ").trim();
            sub = sub.trim().replace(/^the\s/gi, "").replace(/\,\sthe$/gi,"").replace(" & ", " and ").trim();
            return (s.toLocaleUpperCase().includes(sub.toLocaleUpperCase()));
        }
        function splitAlbumTitle(title) {
            title = title.trim();
            var rtval = {full:title, basic:title};
            var regs =  [
                            /^([^$]*[^-\s])(\s-\s)(\w[\w\s]+\sEdition[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(\w[\w\s]+\sVersion[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(\w[\w\s]+\sDeluxe[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(\w[\w\s]+\sRemaster[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(Deluxe[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(Remaster[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(EP[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s-\s)(Explicit[\w\s]*)$/i,
                            /^([^$]*[^-\s])(\s)([\(\[][\w\s]+\sEdition[\w\s]*[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[][\w\s]+\sVersion[\w\s]*[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[][\w\s]+\sDeluxe[\w\s]*[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[][\w\s]+\sRemaster[\w\s]*[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[]Deluxe[\w\s]*[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[]Remaster[\w\s]*[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[]EP[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)([\(\[]Explicit[\)\]])$/i,
                            /^([^$]*[^-\s])(\s)(EP[\d\s]*)$/i
            ];
            for (var i=0; i<regs.length; i++) {
                var m = title.match(regs[i]);
                // 0: full (= basic+spacer+extension)
                // 1: basic
                // 2: spacer
                // 3: extension
                if (m!==null && m.length===4) {
                    rtval.basic = m[1];
                    rtval.spacer = m[2];
                    rtval.extension = m[3];
                    break; // return rtval;
                }
            }
            return rtval;
        }
        function albumCompoundLinkTag(artistname, artistlink, title, albumlink) {
            title = splitAlbumTitle(title);
            if (title.extension) {
                var shortAlbumlink = artistlink + '/' + encodeURIComponent(title.basic).replace(/%20/g, '+') + '/';
                return '<a href="' + shortAlbumlink + '" class="link-block-target" title="' + artistname + ' — ' + title.basic + '">' + title.basic + '</a><span class="albumextension">' + title.spacer + '<a href="' + albumlink + '" class="link-block-target" title="' + artistname + ' — ' + title.full + '">' + title.extension + '</a></span>';
            } else {
                return '<a href="' + albumlink + '" class="link-block-target" title="' + artistname + ' — ' + title.full + '">' + title.full + '</a>';
            }
        }
        linkr.log('Running linking()... ', linkr.INFO);
        var l = document.querySelectorAll('table.chartlist tbody tr .cover-art >  img');
        var tr;
        var albumlink;
        for (var i=0; i < l.length; i++) {
            linkr.log('iteration '+ i + ' of ' + l.length);
            if (l[i].alt && l[i].alt.trim()!=='') {
                l[i].alt = l[i].alt.trim();
                l[i].title = l[i].alt;
                var parent = l[i].parentNode;
                tr = parent;
                while (tr.tagName.toUpperCase()!=='TR') tr = tr.parentNode;
                var a = tr.querySelector('span.chartlist-artists a');
                if (a) {
                    linkr.log('Found img.alt='+l[i].alt);
                    albumlink = a.href + '/' + encodeURIComponent(l[i].alt).replace(/%20/g,'+') + '/';
                    linkr.log('giving albumlink='+albumlink);
                    var link = document.createElement('a');
                    link.setAttribute('href', albumlink);
                    // *** Currently NOT working (CSP error?), so disabled: ***
                    // parent.replaceChild(link, l[i]);
                    // link.appendChild(l[i]);
                    /*
                    if (parent.parentNode.lastChild.nodeType!=='a') {
                        parent.insertChildAfterThis(<a>) or
                        parent.parentNode.insertAsLastChild(<a>)
                    }
                    */
                } else {
                    linkr.log('Artist link not found');
                }
            }
        }

        var hasMorebuttons = !!document.querySelector('td.chartlist-more');
        var tlists = document.querySelectorAll('section#recent-tracks-section table.chartlist tbody, section.tracklist-section tbody');
        linkr.log('tlists.length='+tlists.length);
        for (var j=0; j<tlists.length; j++) {
            linkr.log('Loop with tlists['+j+'].');
            var rows = tlists[j].querySelectorAll('tr.js-link-block');
            if (rows && rows.length > 2) {
                linkr.log('tlists['+j+'] has ' + rows.length + ' rows');
                var loopstart=1;
                if (j===0 && rows[0].classList.contains('now-scrobbling')) {
                    // loopstart=2; // Uncomment this to prevent album-header at very top of Recent Tracks if the 1st row is a currently a scrobbling (yellow) track
                }
                for (i = loopstart; i < rows.length; i++) {
                    linkr.log('for-loop. i=' + i);
                    if (i===1 || !rows[i - 2].classList.contains('albumlink-row')) {
                        linkr.log('for-loop. i=' + i + ' og i-2 er IKKE allerede albumlink-row');
                        if (    altvalue(rows[i]) &&
                                altvalue(rows[i - 1]) &&
                                altvalue(rows[i]) !== '' &&
                                altvalue(rows[i]).toLowerCase() === altvalue(rows[i - 1]).toLowerCase() &&
                                (i===1 || altvalue(rows[i]).toLowerCase() !== altvalue(rows[i - 2]).toLowerCase()) ) {
                            linkr.log('for-loop. i=' + i + ' og vi har fundet en album-gruppes start', linkr.INFO);
                            // TRY to get albumartist right even when misc. featured artists on album tracks:
                            var bestindex = i-1;
                            var artistlinkelem = rows[bestindex].querySelector('td.chartlist-name span.chartlist-artists > a');
                            var albumcoverelem = rows[bestindex].querySelector('td.chartlist-play img');
                            var artistname = artistlinkelem.textContent;
                            var tracks = [{absindex: bestindex, artistname: artistname, coverurl: (albumcoverelem ? albumcoverelem.src : null)}];
                            for (var k=i; k < rows.length; k++) {
                                if (altvalue(rows[i-1]).toLowerCase() !== altvalue(rows[k]).toLowerCase()) break; // new album
                                artistlinkelem = rows[k].querySelector('td.chartlist-name span.chartlist-artists > a');
                                albumcoverelem = rows[k].querySelector('td.chartlist-play img');
                                tracks.push({absindex: k, artistname: artistlinkelem.textContent, coverurl: (albumcoverelem ? albumcoverelem.src : null)});
                                if (rows[k].querySelector('td.chartlist-name span.chartlist-artists > a').textContent.length < artistname.length) {
                                    bestindex = k;
                                    artistname = artistlinkelem.textContent;
                                }
                                // linkr.log('*** k='+k+': altvalue='+altvalue(rows[k])+', artist='+ rows[k].querySelector('td.chartlist-name span.chartlist-artists > a').textContent, true)
                            }
                            var artistlink = rows[bestindex].querySelector('td.chartlist-name span.chartlist-artists > a');
                            var albumtitle = altvalue(rows[bestindex]);
                            var albumcover = rows[bestindex].querySelector('td.chartlist-play img');
                            if (albumcover) albumcover=albumcover.src;
                            if (artistlink) {
                                if (tracks.reduce(function (x, y) {
                                        return x && containing(y.artistname, artistname);
                                    }, true)) { //y.artistname.includes(artistname)
                                    artistlink = artistlink.href;
                                    linkr.log('*** [before split()]: All albumtracks on "' + albumtitle + '" has "' + artistname + '" contained in trackartists');
                                } else {
                                    artistname = artistname.split(',')[0];
                                    artistlink = artistlink.href.split(',')[0];
                                    if (tracks.reduce(function (x, y) {
                                            return x && containing(y.artistname, artistname);
                                        }, true)) {
                                        linkr.log('*** [after split()]: All albumtracks on "' + albumtitle + '" has "' + artistname + '" contained in trackartists');
                                    } else {
                                        // Looks like we have a "Various Artists"...
                                        artistname = 'Various Artists';
                                        artistlink = '/music/Various+Artists';
                                        linkr.log('*** [far after split()]: Seems "' + albumtitle + '" is a "Various Artists" album...');
                                    }
                                }
                                albumlink = artistlink + '/' + encodeURIComponent(albumtitle).replace(/%20/g, '+') + '/';
                                tr = document.createElement('tr');
                                tr.classList.add('albumlink-row', 'js-link-block', 'js-focus-controls-container');                                                                                                                                                  // https://c1.staticflickr.com/3/2821/32308516104_dc32a69ba0_o.png // or http://www.rockland.dk/img/album244c.png // or https://images1-fcus-opensocial.googleusercontent.com/gadgets/proxy?url=http%3A%2F%2Fwww.rockland.dk%2Fimg%2Falbum244c.png&container=focus&resize_w=244&refresh=3600
                                tr.setAttribute('data-ajax-form-state','');
                                tr.setAttribute('data-recenttrack-id','');
                                tr.setAttribute('data-timestamp','');
                                tr.innerHTML = '<td class="chartlist-play"><div class="chartlist-play-image"><a href="' + albumlink + '"><img title="' + albumtitle + '" src="' + albumcover + '" class="cover-art"></a></div></td><td class="chartlist-loved"><a href="' + albumlink.replace(/\/user\/[^\/]+\/library\//, '/') + '"><img src="' + GMC.getResourceUrl('albumIcon')+ '" style="width:24px;height:24px" alt="album" /></a></td><td class="chartlist-name"><span class="chartlist-ellipsis-wrap"><span class="chartlist-artists"><a href="' + artistlink + '" title="' + artistname + '">' + artistname + '</a></span><span class="artist-name-spacer"> — </span>' + albumCompoundLinkTag(artistname, artistlink, albumtitle, albumlink) + '</span></td><td class="chartlist-buylinks chartlist-focus-control-cell"><div class="lazy-buylinks focus-control"><button class="disclose-trigger lazy-buylinks-toggle" aria-expanded="false" data-lazy-buylink="" data-lazy-buylink-url="' + albumlink.replace(/\/user\/[^\/]+\/library\//, '/') + '/+partial/buylinks">Buy</button></div></td>' + (hasMorebuttons ? '<td class="chartlist-more chartlist-focus-control-cell"><div class="focus-control"></div></td>' : '') + '<td class="chartlist-timestamp"></td>';
                                linkr.log('Now trying to add tr...');
                                tlists[j].insertBefore(tr, rows[i - 1]);
                                linkr.log('and should be added now!?');
                                i += 1; // or http://stackoverflow.com/questions/8766910/is-there-a-loop-start-over ?
                            }
                        }
                    }
                }
            } else {
                linkr.log('but not enough children found...');
            }
        }

        // extras here...
        linkr.linkifySidebar();
        linkr.tapmusicSidebar();
        linkr.linking_running = false;
    },
    setupObserver: function () {
        linkr.log('Running setupObserver()');
        linkr.insertStyle();
        linkr.observed = document.querySelector('table.chartlist > tbody');
        if (!linkr.observed || !linkr.observed.classList) {
            linkr.log('Object to observe NOT found - re-trying later...');
        } else if (linkr.observed.classList.contains('hasObserver')) {
            linkr.log('Everything is okay! - But checking again later...');
        } else {
            linkr.linking();
            linkr.log('Now adding Observer and starting...', linkr.INFO);
            var observer = new MutationObserver(linkr.linking);
            var config = {attributes: false, childList: true, subtree: false, characterData: false};
            observer.observe(linkr.observed, config);
            linkr.observed.classList.add('hasObserver');
            linkr.log('Observer added and running...');
        }
    },
    linkifyStr: function (str, attributes) {
        var a1 = '<a ' + (attributes ? attributes+' ' : '') + 'href="';
        var a2 = '">';
        var a3 = '</a>';
        var url = /(^|\s|\(|>)([fhtpsr]+:\/\/[^\s]+?)([\.,;\]"]?(\s|$|\))|<)/igm;
        // var url2 = /(^|\s|\()([fhtpsr]+:\/\/[^\s]+?)([\.,;\]"]?(\s|$|\)))/igm;
        // This looks a bit weird, but we have to do a replace twice to catch URLs
        // which immediately follow each other. This is because leading and trailing
        // whitespaces are part of the expressions, and if a trailing whitespace of
        // a match needs to be a leading whitespace of the next URL to match, it
        // won't be caught.
        var s = str.replace(url, '$1' + a1 + '$2' + a2 + '$2' + a3 + '$3$4');
        return(s.replace(url, '$1' + a1 + '$2' + a2 + '$2' + a3 + '$3$4'));
    },
    linkifySidebar: function() {
        if (linkr.linkifyEnabled) {
            var a = document.querySelectorAll('.about-me-sidebar p');
            for (var i = 0; i < a.length; i++) {
                a[i].innerHTML = linkr.linkifyStr(a[i].innerHTML);
            }
        }
    },
    tapmusicSidebar: function() {
        if (linkr.collagetype) {
            //  /user/userid
            var pattern = /^\/user\/([^\/]+)/i;
            var result = window.location.pathname.match(pattern);
            if (result) {
                linkr.log('tapmusicSidebar(): url match med userid=' + result[1]);
                var b = document.querySelector('.stationlinks');
                if (b && !document.getElementById('tapmusic')) {
                    b.insertAdjacentHTML('beforeend', '<div style="margin:1em 0;width:300px" id="tapmusic"><div class="tapcollage"><img src="https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?url=http%3A%2F%2Fwww.tapmusic.net%2Fcollage.php%3Fuser%3D' + result[1] + '%26type%3D'+linkr.collagetype+'%26size%3D2x6&container=focus&resize_w=300&refresh=3600" alt="If this text is visible, tapmusic.net might be slow or not responding - or the profile you are looking at does not have recent scrobbles to generate a collage from... But sometimes a simple re-load of page also helps." style="display:block;margin:0;padding:0;width:300px;height:900px" decoding="async" /></div><div class="tapcredit"><em title="Album collage by www.tapmusic.net/lastfm - Embedded by Stig\'s Last.fm Album Linkr">Album collage by <a href="http://www.tapmusic.net/lastfm/">www.tapmusic.net/lastfm/</a></em></div></div>');
                }
            } else {
                linkr.log('tapmusicSidebar(): returnerer false! reg-pattern fandt ikke match i pathname=' + window.location.pathname);
            }
        }
    },
    init: function () {
        linkr.log('Running init() on last.fm');
        linkr.loadSettings();
        linkr.setupObserver();
        setInterval(linkr.setupObserver,2000);
        GMC.registerMenuCommand("Album Collages - Disabled", linkr.collageOff, {accessKey: "D", type: "radio", name: 'collage', checked: (linkr.collagetype==='')});
        GMC.registerMenuCommand("Album Collages - 7 Days", linkr.collage7day, {accessKey: "7", type: "radio", name: 'collage', checked: (linkr.collagetype==='7day')});
        GMC.registerMenuCommand("Album Collages - 1 Month", linkr.collage1month, {accessKey: "1", type: "radio", name: 'collage', checked: (linkr.collagetype==='1month')});
        GMC.registerMenuCommand("Album Collages - 3 Months", linkr.collage3month, {accessKey: "3", type: "radio", name: 'collage', checked: (linkr.collagetype==='3month')});
        GMC.registerMenuCommand("Album Collages - 6 Months", linkr.collage6month, {accessKey: "6", type: "radio", name: 'collage', checked: (linkr.collagetype==='6month')});
        GMC.registerMenuCommand("Album Collages - 1 Year", linkr.collage12month, {accessKey: "Y", type: "radio", name: 'collage', checked: (linkr.collagetype==='12month')});
        GMC.registerMenuCommand("Album Collages - Overall", linkr.collageOverall, {accessKey: "O", type: "radio", name: 'collage', checked: (linkr.collagetype==='overall')});
        GMC.registerMenuCommand("Linkify About Me section", linkr.toggleLinkifyEnabled , {accessKey: "L", type: "checkbox", checked: (linkr.linkifyEnabled)});
        GMC.registerMenuCommand("Collapse the top", linkr.toggleCollapseTop , {accessKey: "C", type: "checkbox", checked: (linkr.collapseTop)});
    }
};

linkr.init();
