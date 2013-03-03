/*
Zy
A small and fast NodeJS routing and presentation web framework.
Version 0.1

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
    path:     require('path'),
    dot:      require('dot')
}


// patch external url.parse to make it more appropriate for our needs
Zy.lib.url._parse = Zy.lib.url.parse;
Zy.lib.url.parse = function (url, bool) {
    var parts = Zy.lib.url._parse(url, bool);

    // ensure pathname always ends in a slash, for ease of comparison
    if (parts.pathname[parts.pathname.length - 1] !== '/') {
        parts.pathname += '/';
    }

    return parts;
}


// define output functionality
Zy.output = {
    FILE:       1,
    TEMPLATE:   2,
    FUNCTION:   3,

    type: function (output) {
        if (typeof output === 'string') {
            var ext = Zy.lib.path.extname(output);

            if (ext === '.tpl') {
                return Zy.output.TEMPLATE;
            } else {
                return Zy.output.FILE;
            }

        } else if (typeof output === 'object') {
            return Zy.output.TEMPLATE;

        } else if (typeof output === 'function') {
            return Zy.output.FUNCTION;
        }
    },

    load: function (output, params) {
        // process output data structure?
        var data,
            filename = output;

        if (typeof output === 'object') {
            if (typeof output.length === 'number') {
                // array
                filename    = output[0],
                    data    = output[1];

            } else {
                // object
                filename    = output.filename,
                    data    = output.data;
            }
        }


        // check that file exists
        Zy.lib.fs.exists(filename, function (exists) {
            if (exists) {
                Zy.lib.fs.readFile(filename, function (error, content) {
                    if (!error) {
                        params[200](content, data);

                    } else {
                        console.log('error');
                        response.writeHead(500);
                        response.end();
                    }
                });

            } else {
                response.writeHead(404);
                response.end();
            }
        });
    },

    send: function (response, params) {
        response.writeHead(
            params.code     || 200,
            params.params   || {}
        );

        if (typeof params.content !== 'undefined') {
            response.end(params.content, 'utf-8');
        } else {
            response.end();
        }

    }
};


// define server start functionality
Zy.start = function (config) {
    // setup server
    Zy.lib.http
        .createServer(function (request, response) {
            // parse URL into useful parts
            var url = Zy.lib.url.parse(request.url, true);

            // look for specified route...
            var output = config.routes[url.pathname];

            if (typeof output === 'undefined') {
                // route not found, default to 404 page
                output = config.routes[404];
            }


            // process output...
            var outputType = Zy.output.type(output);

            if (outputType === Zy.output.FILE) {
                // file...
                // - load file
                var content = Zy.output.load(
                    output,
                    {
                        200: function (content) {
                            // check content type
                            var contentType,
                                ext = Zy.lib.path.extname(output);

                            if (ext === '.js') {
                                contentType = 'text/javascript';

                            } else if (ext === '.css') {
                                contentType = 'text/css';
                            }

                            // - send output
                            Zy.output.send(
                                response,
                                {
                                    'content':  content,
                                    'params':   {
                                        'Content-Type': contentType || 'text/html'
                                    }
                                }
                            );
                        }
                    }
                );


            } else if (outputType === Zy.output.TEMPLATE) {
                // template...
                // - load template file
                var content = Zy.output.load(
                    output,
                    {
                        200: function (content, data) {
                            // - insert data into template
                            var rendered = Zy.lib.dot.template(content)(data);

                            // - send output
                            Zy.output.send(
                                response,
                                {
                                    'content': rendered
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
        .listen(config.port);


    // inform that server has started on specified port
    console.log('Server running at http://127.0.0.1:' + config.port);
}


// make Zy accessible as an imported Node module
exports.Zy = Zy;