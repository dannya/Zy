/*
Zy
A small and fast NodeJS routing and presentation web framework.
Version 0.2.1

Copyright (C) 2013 Danny Allen <me@dannya.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// initialize internal Zy namespace
var Zy = {};


// import Zy requirements
Zy.lib = {
    http:     require('http'),
    url:      require('url'),
    fs:       require('fs'),
    path:     require('path')
};


// initialise default config
// Note: you shouldn't need to change these values, instead override them in the config object passed into Zy.start()
Zy.config = {
    port:   8000,

    routes: {
        '/': function () {
            return 'Welcome to Zy!';
        },

        403: function () {
            return '403';
        },
        404: function () {
            return '404';
        },
        500: function () {
            return '500';
        }
    },

    contentType: {
        '.css':     'text/css',
        '.js':      'text/javascript',
        '.txt':     'text/plain'
    }
};


// define utility functions
Zy.util = {
    merge: function (obj1, obj2) {
        for (var k in obj2) {
            try {
                if (typeof obj2[k] === 'object') {
                    obj1[k] = Zy.util.merge(obj1[k], obj2[k]);

                } else {
                    obj1[k] = obj2[k];

                }

            } catch (e) {
                obj1[k] = obj2[k];
            }
        }

        return obj1;
    }
};


// define routing functionality
Zy.routing = {
    get: function (id) {
        return Zy.config.routes[id] || Zy.config.routes[404] || Zy.config.routes['/'];
    }
};


// define location functionality
Zy.location = {
    FILE:       1,
    DIRECTORY:  2,

    type: function (string) {
        return (string.indexOf('.') === -1) ?
            Zy.location.DIRECTORY :
            Zy.location.FILE;
    },

    path: function (path) {
        var path = path.split('/');
        path.pop();

        return path.join('/');
    },

    // wrap external url.parse to make it more appropriate for our needs
    parse: function (url, bool) {
        var parts = Zy.lib.url.parse(url, bool);

        // ensure directory pathname always ends in a slash, for ease of comparison
        if ((parts.pathname[parts.pathname.length - 1] !== '/') && (Zy.location.type(parts.pathname) === Zy.location.DIRECTORY)) {
            parts.pathname += '/';
        }

        return parts;
    }
};


// define output functionality
Zy.output = {
    FILE:       1,
    FUNCTION:   2,

    type: function (output) {
        if (typeof output === 'string') {
            return Zy.output.FILE;

        } else if (typeof output === 'function') {
            return Zy.output.FUNCTION;
        }
    },

    load: function (response, output, params) {
        // process output data structure?
        var data,
            filename = output;

        if (typeof output === 'object') {
            if (typeof output.length === 'number') {
                // array
                filename    = output[0],
                data        = output[1];

            } else {
                // object
                filename    = output.filename,
                data        = output.data;
            }
        }


        // check that file exists
        Zy.lib.fs.exists(filename, function (exists) {
            if (exists) {
                Zy.lib.fs.readFile(filename, function (error, content) {
                    if (!error) {
                        // no error, execute 200 callback
                        params[200](content, data);

                    } else {
                        // send 500 response
                        Zy.output.send(
                            response,
                            {
                                code: 500
                            }
                        );
                    }
                });

            } else {
                // send 404 response
                Zy.output.send(
                    response,
                    {
                        code: 404
                    }
                );
            }
        });
    },

    send: function (response, params) {
        response.writeHead(
            (typeof params.code === 'number')   ? params.code   : 200,
            (typeof params.params === 'object') ? params.params : {}
        );

        if (typeof params.content !== 'undefined') {
            response.end(params.content, 'utf-8');
        } else {
            response.end();
        }

    }
};


// define scripting functionality
Zy.scripting = {
    iterateFilePath: function (filepath, theFilter, group, individual) {
        // if filter is not expressed as a function, assume file extension string and create function
        if (typeof theFilter == 'string') {
            var filterString = theFilter;

            theFilter = function (filename) {
                return (filename.substr(-filterString.length) == filterString);
            };
        }

        // iterate
        Zy.lib.fs.readdir(
            filepath,
            function (err, files) {
                if ((typeof files == 'object') && (files.length > 0)) {
                    var filtered = files.filter(theFilter);

                    if (filtered.length > 0) {
                        // execute group, or individual callback?
                        if (typeof group == 'function') {
                            group(filepath, filtered);
                        }

                        if (typeof individual == 'function') {
                            filtered.forEach(function (file) {
                                individual(filepath + file);
                            });
                        }
                    }
                }
            }
        );
    },

    touchFiles: function (filepaths) {
        var fd,
            date = new Date();

        // iterate through filepaths...
        for (var i = 0, len = filepaths.length; i < len; i++) {
            fd = Zy.lib.fs.openSync(filepaths[i], 'r');

            // set file time
            Zy.lib.fs.futimes(fd, date, date);
        }
    }
};


// define server start functionality
Zy.start = function (config) {
    // merge specified config into default config, overwriting where provided
    Zy.config = Zy.util.merge(Zy.config, config);


    // setup server
    Zy.lib.http
        .createServer(function (request, response) {
            // parse URL into useful parts
            var url = Zy.location.parse(request.url, true);

            // look for specified route...
            var output = Zy.config.routes[url.pathname];

            if (typeof output === 'undefined') {
                // route not found, check if reference is to an allowable file location...
                if (Zy.location.type(url.pathname) === Zy.location.FILE) {
                    // a file...
                    // - check if it is in an allowable location? (default: yes)
                    if ((typeof Zy.config.safeDirectories !== 'object') ||
                        (typeof Zy.config.safeDirectories[Zy.location.path(url.pathname)] !== 'undefined')) {

                        // an allowable location, modify to a retrievable reference
                        output = '.' + url.pathname;

                    } else {
                        // not an allowable location
                        output = Zy.routing.get(403);
                    }

                } else {
                    // not a file, default to 404 page
                    output = Zy.routing.get(404);
                }
            }


            // process output...
            var outputType = Zy.output.type(output);

            if (outputType === Zy.output.FILE) {
                // file...
                // - load file
                var content = Zy.output.load(
                    response,
                    output,
                    {
                        200: function (content) {
                            // get content type
                            var ext         = Zy.lib.path.extname(output),
                                contentType = Zy.config.contentType[ext];

                            if (typeof contentType !== 'string') {
                                // not found in contentType mapping, default to HTML
                                contentType = 'text/html';
                            }

                            // - send output
                            Zy.output.send(
                                response,
                                {
                                    'content':  content,
                                    'params':   {
                                        'Content-Type': contentType
                                    }
                                }
                            );
                        }
                    }
                );


            } else if (outputType === Zy.output.FUNCTION) {
                // function...
                // - get output
                var content = output(request, response);

                // - send output?
                if (typeof content === 'string') {
                    // only handle content output if function returns a string, otherwise
                    // assume the function handles output itself
                    Zy.output.send(
                        response,
                        {
                            'content': content
                        }
                    );
                }
            }
        })
        .listen(Zy.config.port);


    // inform that server has started on specified port
    console.log('Server running at http://127.0.0.1:' + Zy.config.port);
};


// make Zy accessible as an imported Node module
exports.Zy = Zy;