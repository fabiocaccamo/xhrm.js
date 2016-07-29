(function(){

    var _settings = { baseURL:'' };
    var _counter = 1;
    var _requests = {};

    function _registerRequest( request )
    {
        var overwrite = request.options.overwrite;

        if( overwrite == xhrm.overwrite.NONE )
        {
            _requests[ request.id ] = request;

            return true;
        }
        else {

            var overwriteSameState = (( overwrite & xhrm.overwrite.SAME_STATE ) == xhrm.overwrite.SAME_STATE );
            var overwriteSameURL = (( overwrite & xhrm.overwrite.SAME_URL ) == xhrm.overwrite.SAME_URL );

            var id, requestActive, requestsSameState, requestsSameURL;

            for( id in _requests )
            {
                requestActive = _requests[ id ];

                requestsSameState = (requestActive.options.state == request.options.state);
                requestsSameURL = (requestActive.options.url == request.options.url);

                if( overwriteSameState && overwriteSameURL )
                {
                    if( requestsSameState && requestsSameURL )
                    {
                        requestActive.cancel();
                    }
                }
                else if( overwriteSameState )
                {
                    if( requestsSameState )
                    {
                        requestActive.cancel();
                    }
                }
                else if( overwriteSameURL )
                {
                    if( requestsSameURL )
                    {
                        requestActive.cancel();
                    }
                }
            }

            _requests[ request.id ] = request;

            return true;
        }
    };

    function _unregisterRequest( request )
    {
        var registered = (_requests[ request.id ] != undefined);

        _requests[ request.id ] = null;
        delete _requests[ request.id ];

        return registered;
    };

    var xhrm = {

        overwrite: {

            //the request will persist until it will be completed or cancelled
            NONE:0,

            //allow only 1 request for the same state at time, new requests to the same state will override existing ones (if cancelable)
            //the state value should be provided within options and it value will be obtained doing String(options.state),
            //so you can pass also an object which implements its own toString() method
            SAME_STATE:(1 << 0),

            //allow only 1 request for the same url at time, new requests to the same url will override existing ones (if cancelable)
            SAME_URL:(1 << 1)
        },

        configRequests:function( settings )
        {
            _settings = $.extend({}, {

                baseURL:''

            }, settings );

            if( _settings.baseURL && _settings.baseURL.length > 0 && _settings.baseURL.charAt(_settings.baseURL.length - 1) != '/' ){
                _settings.baseURL += '/';
            }
        },

        createRequest:function( options )
        {
            if( options == undefined )
            {
                throw new Error('[xhrm] options cannot be undefined');
            }

            if( typeof(options) != 'object' )
            {
                throw new Error('[xhrm] options should be an {}');
            }

            if( typeof(options.url) != 'string' )
            {
                throw new Error('[xhrm] options.url cannot be undefined');
            }

            if( options.url == '' )
            {
                throw new Error('[xhrm] options.url cannot be empty');
            }
            else if( options.url.substring(0, 4).toLowerCase() != 'http' && _settings.baseURL != '' )
            {
                if( options.url.charAt(0) == '/' ){
                    options.url = options.url.substring(1);
                }

                options.url = (_settings.baseURL + options.url);
            }

            //easy contentType setting
            var contentTypes = {
                html: 'text/html; charset=utf-8',
                json: 'application/json; charset=utf-8',
                text: 'text/plain; charset=utf-8',
                vars: 'application/x-www-form-urlencoded; charset=utf-8'
            };

            var contentType = (contentTypes[ options.contentType ] || contentTypes[ options.requestType ] || contentTypes[ options.requestContentType ]);
            if( contentType ){
                contentType = contentType.toLowerCase()

                options.contentType = contentType;
            }

            var dataType = (options.dataType || options.responseType || options.responseContentType);
            if( dataType ){
                dataType = dataType.toLowerCase();

                if( dataType == 'jquery' ){
                    dataType = 'text';

                    options.dataTypeJQuery = true;
                }

                options.dataType = dataType;
            }

            var request = {};
            request.id = String(_counter++);
            request.options = $.extend({}, {

                data: {},
                crossDomain: true,
                timeout: (1000 * 15),
                overwrite: this.overwrite.NONE,
                state: ''

            }, options );

            if( request.options.state ){
                request.options.state = String(request.options.state);

                if( request.options.state == '' && ((request.options.overwrite & this.overwrite.SAME_STATE) == this.overwrite.SAME_STATE) )
                {
                    throw new Error('[xhrm] options.state cannot be "' + request.options.state + '" if the overwrite.SAME_STATE flag is present.')
                }
            }

            request.sent = false;
            request.send = function()
            {
                if(!request.sent && !request.cancelled && _registerRequest( request )){
                    request.sent = true;

                    request.xhr = $.ajax( request.options );

                    return true;
                }
                else {
                    return false;
                }
            };

            request.cancelable = (request.options.cancelable === false ? false : true);
            request.cancelled = false;
            request.cancel = function()
            {
                if(!request.cancelled && request.cancelable){
                    request.cancelled = true;

                    if( request.xhr && request.xhr.readystate != 4 ){
                        request.xhr.abort();
                    }

                    _unregisterRequest( request );

                    return true;
                }
                else {
                    return false;
                }
            };

            request.clone = function()
            {
                return xhrm.createRequest( $.extend({}, options ) );
            };

            request.toString = function()
            {
                return '[xhrm][request=' + this.id + ']';
            };

            request.options.successCallback = request.options.success;
            request.options.success = function( data, text )
            {
                if( request.cancelled ){
                    return;
                }

                _unregisterRequest( request );

                if( typeof(request.options.successCallback) === 'function' )
                {
                    try {
                        if( request.options.dataTypeJQuery ){
                            request.options.successCallback( $('<div></div>').append(data), text );
                        }
                        else {
                            request.options.successCallback( data, text );
                        }
                    }
                    catch(error){

                        if( typeof(request.options.errorCallback) === 'function' )
                        {
                            //parsing error
                            request.options.errorCallback( new Error( '[xhrm] parsing error - ' + error.message ) );
                        }
                    }
                }
            };

            request.options.errorCallback = request.options.error;
            request.options.error = function( jqXHR, textStatus, errorThrown )
            {
                if( request.cancelled || textStatus == 'abort' ){
                    return;
                }

                _unregisterRequest( request );

                if( typeof(request.options.errorCallback) === 'function' )
                {
                    request.options.errorCallback( new Error( jqXHR.statusText + ' ' + jqXHR.status ) );
                }
            };

            return request;
        },

        sendRequest:function( options )
        {
            var request = this.createRequest( options );
            request.send();
            return request;
        },

        cancelRequestByID:function( id )
        {
            var request = _requests[ String(id) ];

            if( request != undefined )
            {
                return request.cancel();
            }
            else {
                return false;
            }
        },

        cancelAllRequests:function()
        {
            var id, request;

            for( id in _requests )
            {
                this.cancelRequestByID( id );
            }
        }


    };


    document.xhrm = window.xhrm = xhrm;
    document.XHRM = window.XHRM = xhrm;
    document.XMLHttpRequestManager = window.XMLHttpRequestManager = xhrm;


})();

