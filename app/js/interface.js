var interface = {
    browse: function(type) {
        console.info('Opening File Browser');
        var input = document.querySelector('#' + type + '-file-path-hidden');
        input.addEventListener('change', function(evt) {
            var file = $('#' + type + '-file-path-hidden')[0].files[0];
            window.ondrop({
                dataTransfer: {
                    files: [file]
                },
                preventDefault: function() {}
            });
        }, false);
        input.click();
    },
    check_visible: function(options) {
        var screen = window.screen;
        var defaultWidth = require('../package.json').window.width;
        var defaultHeight = require('../package.json').window.height;

        var width = parseInt(localStorage.width ? localStorage.width : defaultWidth);
        var height = parseInt(localStorage.height ? localStorage.height : defaultHeight);
        var x = parseInt(localStorage.posX ? localStorage.posX : -1);
        var y = parseInt(localStorage.posY ? localStorage.posY : -1);

        // reset x
        if (x < 0 || (x + width) > screen.width) {
            x = Math.round((screen.availWidth - width) / 2);
        }

        // reset y
        if (y < 0 || (y + height) > screen.height) {
            y = Math.round((screen.availHeight - height) / 2);
        }

        win.moveTo(x, y);
    },
    add_video: function (file) {
        console.info('Adding new video!');
        $('#main-video-shadow').show().css('opacity', '1')

        var info = {};
        OS.extractInfo(file).then(function (data) {
            info = {
                moviefilename: path.basename(file),
                moviebytesize: data.moviebytesize,
                moviehash: data.moviehash,
                quality: misc.extractQuality(path.basename(file))
            }
        }).then(function () {
            return OS.identify(file);
        }).then(function (data) {
            if (data.metadata && data.metadata.imdbid) {
                info.metadata = data.metadata;
                info.imdbid = data.metadata.imdbid;
            }
            return interface.mediainfo(file);
        }).then(function (args) {
            interface.reset('video');
            if (args && args.length === 5) {
                $('#movietimems').val(args[0]);
                $('#moviefps').val(args[3]);
                $('#movieframes').val(args[4]);
                if (args[2] >= 720) $('#highdefinition').prop('checked', true);
            }
            $('#video-file-path').val(file);
            $('#moviefilename').val(info.moviefilename);
            $('#moviebytesize').val(info.moviebytesize);
            $('#moviehash').val(info.moviehash);
            if (info.quality && info.quality.match(/720|1080/i)) $('#highdefinition').prop('checked', true);
            if (info.imdbid) $('#imdbid').val(info.imdbid);
            if (info.metadata) {
                var title = '', d = info.metadata;
                if (d.episode_title) {
                    title += d.title + ' ' + d.season + 'x' + d.episode + ', ' + d.episode_title;
                } else {
                    title += d.title + '(' + d.year + ')';
                }
                $('#imdb-info').attr('title', 'IMDB: ' + title).attr('imdbid', info.imdbid).show();
            }
            $('#main-video-shadow').css('opacity', '0').hide();
        }).catch(function(err) {
            interface.reset('video');
            $('#main-video-shadow').css('opacity', '0').hide();
            console.error(err);
        });
    },
    add_subtitle: function (file) {
        console.info('Adding new subtitle!');
        interface.reset('subtitle');
        $('#subtitle-file-path').val(file);
        $('#subfilename').val(path.basename(file));
        OS.computeMD5(file).then(function (data) {
            $('#subhash').val(data);
        });
    },
    reset: function (type) {
        if (type) console.debug('Clear form:', type);
        switch (type) {
            case 'video':
                $('#video-file-path').val('');
                $('#moviefilename').val('');
                $('#moviehash').val('');
                $('#moviebytesize').val('');
                $('#imdbid').val('');
                $('#movieaka').val('');
                $('#moviereleasename').val('');
                $('#moviefps').val('');
                $('#movietimems').val('');
                $('#movieframes').val('');

                $('#highdefinition').prop('checked', false);
                $('#imdb-info').attr('title', '').hide();
                if ($('#upload-result').css('display') === 'block') interface.reset('upload');
                break;
            case 'subtitle':
                $('#subtitle-file-path').val('');
                $('#subfilename').val('');
                $('#subhash').val('');
                $('#subauthorcomment').val('');

                $('#hearingimpaired').prop('checked', false);
                $('#automatictranslation').prop('checked', false);

                $('#sublanguageid').val('');
                if ($('#upload-result').css('display') === 'block') interface.reset('upload');
                break;
            case 'search':
                $('#search-text').val('');
                $('#search-result').html('');
                break;
            case 'upload':
                $('#button-upload').removeClass('success partial fail');
                $('#upload-result .result').html('');
                $('#button-upload i').removeClass('fa-check fa-quote-left fa-close').addClass('fa-cloud-upload');
                $('#upload-result').hide();
                break;
            default:
                interface.reset('video');
                interface.reset('subtitle');
                interface.reset('search');
                interface.reset('upload');
        }
    },
    searchPopup: function () {
        console.debug('Opening IMDB search popup');
        $(document).bind('mouseup', interface.leavePopup);

        var begin_title = [], count = 0, title = misc.clearName($('#moviefilename').val()).split(' ');
        for (var t in title) {
            if (title[t].match(/^(the|an|19\d{2}|20\d{2}|a|of|in)$/i) === null && count < 3 ) {
                begin_title.push(title[t]);
                count++;
            }
        }
        $('#search-popup').show().css('opacity', 1);
        $('#search-text').val(begin_title.join(' '));
        $('#search-text').select();
    },
    leavePopup: function (e) {
        var container = $('#search');
        if (!container.is(e.target) && container.has(e.target).length === 0) {
            console.debug('Closing IMDB search popup');
            $('#search-popup').css('opacity', 0).hide();
            $('#search-result').hide();
            $('#search').css({
                height: '20px',
                top: 'calc(50% - 80px)'
            });
            interface.reset('search');
            $(document).unbind('mouseup', interface.leavePopup);
        }
    },
    imdb_fromsearch: function (id, title) {
        console.debug('Adding IMDB id to main form');
        id = id > 9999999 ? id : 'tt'+id;
        $('#imdbid').val(id);
        $('#imdb-info').attr('title', 'IMDB: ' + title).attr('imdbid', id).show();
        interface.leavePopup({});
    },
    mediainfo: function (file) {
        return new Promise(function (resolve, reject) {
            var cmd;
            if (process.platform === 'win32') {
                cmd = '"' + process.cwd() + '/mi-win32/mi.exe" --Inform=Video;::%Duration%::%Width%::%Height%::%FrameRate%::%FrameCount%' + ' "' + file + '"';
            } else if (process.platform === 'linux') {
                var arch = process.arch.match(/64/) ? '64' : '32';
                cmd = 'LD_LIBRARY_PATH='+ process.cwd() + '/mi-linux'+ arch +'/' + ' ' + process.cwd() + '/mi-linux' + arch + '/mi --Inform="Video;::%Duration%::%Width%::%Height%::%FrameRate%::%FrameCount%"' + ' "' + file + '"';
            } else {
                resolve(false);
            }

            console.debug('Spawning MediaInfo binary');
            require('child_process').exec(cmd,  function (error, stdout, stderr) {
                if (error !== null || stderr !== '') {
                    console.error('MediaInfo exec error:', (error || stderr));
                    resolve(false);
                } else {
                    var args = stdout.replace('::','').replace('\n','').split('::');
                    resolve(args);
                }
            });
        });
    },
    keyEnter: function (id) {
        if (!id || id === 'subauthorcomment') {
            return;
        } else if (id === 'login-username' || id === 'login-password') {
            $('#button-login').click();
        } else if (id === 'search-text') {
            $('#button-search').click();
        } else {
            var inputs = $(':input');
            var nextInput = inputs.get(inputs.index(document.activeElement) + 1);
            if (nextInput) {
                nextInput.focus();
            }
        }
    } 
};
