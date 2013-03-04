Zy
==
A small and fast NodeJS routing and presentation web framework.


How to use
----------
```javascript
// import Zy
var Zy = require('zy').Zy;

// start Zy using defined settings / routes
Zy.start({
    port:   8001,

    routes: {
        // file-based content
        404: './404.html',
        500: './500.html',

        // template-based content
        '/': [
            './index.tpl',
            {
                'title':    'hi!',
                'text':     'hello'
            }
        ],

        // function-based content
        '/about/': function () {
            return 'content';
        }
    }
});
```
