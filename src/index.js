var fs = require("fs"),
    debug = require("debug"),

    mime = require("mime"),
    crypto = require("crypto"),
    HttpError = require("http_error"),
    filePath = require("file_path");


function normalizeRoot(root) {
    if (!root || root === ".") return "/";
    if (root[0] === ".") root = root.slice(1);
    if (root[0] !== "/") root = "/" + root;
    if (root[root.length - 1] !== "/") root += "/";
    return root;
}

function etagFn(buffer) {

    return crypto.createHash("md5").update(buffer).digest("base64");
}

function StaticServe(options) {
    options || (options = {});

    this.root = normalizeRoot(options.root || "assets");
    this.rootLength = this.root.length;

    this.directory = options.directory || "./assets";
    this.fullDirectory = filePath.isAbsolute(this.directory) ? this.directory : filePath.join(process.cwd(), this.directory);

    this.index = options.index != null ? options.index : "index.html";

    this.debug = debug("Static Serve");

    this.etagFn = typeof(options.etagFn) === "function" ? options.etagFn : etagFn;

    this.options = {
        maxAge: options.maxAge || 86400000,
        fallback: options.fallback != null ? !!options.fallback : false,
        etag: options.etag != null ? !!options.etag : true,
        lastModified: options.lastModified != null ? !!options.lastModified : true
    };
}

StaticServe.express = function(options) {
    var staticServe = new StaticServe(options);

    return function(req, res, next) {

        staticServe.middleware(req, res, next);
    };
};

StaticServe.connect = StaticServe.express;

StaticServe.prototype.middleware = function(req, res, next) {
    var _this = this,
        method = req.method,
        pathname = req.pathname,
        relativeName,
        fileName;

    if (method !== "GET" && method !== "HEAD") {
        next();
        return;
    }
    if (pathname.indexOf(this.root) !== 0) {
        next();
        return;
    }

    relativeName = pathname.substring(this.rootLength);
    fileName = filePath.join(this.fullDirectory, relativeName);

    fs.stat(fileName, function(err, stat) {
        if (err) {
            next(new HttpError(404, err));
            return;
        }
        if (!stat) {
            next();
            return;
        }

        if (stat.isDirectory()) {
            if (!_this.index) {
                next();
                return;
            }

            relativeName = _this.index;
            fileName = filePath.join(fileName, relativeName);

            fs.stat(fileName, function(err, stat) {
                if (err || !stat) {
                    next(new HttpError(404, err));
                    return;
                }

                _this.send(res, relativeName, fileName, stat, next);
            });
        } else {
            _this.send(res, relativeName, fileName, stat, next);
        }
    });
};

StaticServe.prototype.send = function(res, relativeName, fileName, stat, next) {
    var isHead = res.request.method === "HEAD",
        options = this.options,
        ext = filePath.ext(fileName),
        type = mime.lookUpType(ext, options.fallback),
        modified, stream;

    if (type) {
        modified = res.modified(stat.mtime);

        res.contentType = type;
        res.statusCode = modified ? 200 : 304;

        if (options.maxAge && !res.getHeader("Cache-Control")) {
            res.setHeader("Cache-Control", "public, max-age=" + (options.maxAge / 1000));
        }
        if (modified && options.lastModified && !res.getHeader("Last-Modified")) {
            res.setHeader("Last-Modified", stat.mtime.toUTCString());
        }
        if (options.etag && !res.getHeader("ETag")) {
            res.setHeader("ETag", 'W/"' + this.etagFn(this.etag(fileName, stat)) + '"');
        }
        if (!res.getHeader("Date")) {
            res.setHeader("Date", new Date().toUTCString());
        }

        if (isHead) {
            this.debug("HEAD " + relativeName + " as " + type);

            res.setHeader("Content-Length", 0);
            res.end();
            next();
        } else {
            this.debug(relativeName + " as " + type);

            res.setHeader("Content-Length", stat.size);

            stream = fs.createReadStream(fileName);

            stream.on("error", function(err) {
                if (res.headersSent) {
                    console.log(err.stack);
                    stream.destroy();
                }
            });

            stream.on("open", function() {
                stream.pipe(res);
            });
        }
    } else {
        next(new HttpError(415));
    }

    return this;
};

StaticServe.prototype.etag = function(fileName, stat) {

    return String(stat.mtime.getTime()) + ':' + String(stat.size) + ':' + fileName;
};


module.exports = StaticServe;
