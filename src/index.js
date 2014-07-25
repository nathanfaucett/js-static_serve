var fs = require("fs"),

    HttpError = require("http_error"),
    filePath = require("file_path");

function normalizeRoot(root) {
    if (!root || root === ".") return "/";
    if (root[0] === ".") root = root.slice(1);
    if (root[0] !== "/") root = "/" + root;
    if (root[root.length - 1] !== "/") root += "/";
    return root;
}

function StaticServe(opts) {
    opts || (opts = {});

    this.root = normalizeRoot(opts.root || "assets");
    this.rootLength = this.root.length;

    this.directory = opts.directory || "./app/assets";
    this.fullDirectory = filePath.join(process.cwd(), this.directory);

    this.index = opts.index != null ? opts.index : "index.html";

    this.options = {
        maxAge: opts.maxAge || 86400000,
        fallback: opts.fallback != null ? !!opts.fallback : false,
        etag: opts.etag != null ? !!opts.etag : true,
        lastModified: opts.lastModified != null ? !!opts.lastModified : true
    };
}

StaticServe.prototype.middleware = function(req, res, next) {
    var _this = this,
        method = req.method,
        pathname = req.pathname,
        fileName;

    if (method !== "GET" && method !== "HEAD") {
        next();
        return;
    }
    if (pathname.indexOf(this.root) !== 0) {
        next();
        return;
    }

    fileName = filePath.join(this.fullDirectory, pathname.substring(this.rootLength));

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
            fileName = filePath.join(fileName, _this.index);

            fs.stat(fileName, function(err, stat) {
                if (err || !stat) {
                    next(new HttpError(404, err));
                    return;
                }

                _this.send(res, fileName, stat, next);
            });
        } else {
            _this.send(res, fileName, stat, next);
        }
    });
};

StaticServe.prototype.send = function(res, fileName, stat, next) {
    var app = res.app,
        isHead = res.request.method === "HEAD",
        opts = this.options,
        modified = res.modified(stat.mtime),
        ext = filePath.ext(fileName),
        type = app.mime.lookUpType(ext, opts.fallback),
        modified, stream;

    if (type) {
        modified = res.modified(stat.mtime);

        res.contentType = type;
        res.statusCode = modified ? 200 : 304;

        if (opts.maxAge && !res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "public, max-age=" + (opts.maxAge / 1000));
        if (modified && opts.lastModified && !res.getHeader("Last-Modified")) res.setHeader("Last-Modified", stat.mtime.toUTCString());
        if (opts.etag && !res.getHeader("ETag")) res.setHeader("ETag", 'W/"' + app.get("etag fn")(this.etag(fileName, stat)) + '"');
        if (!res.getHeader("Date")) res.setHeader("Date", new Date().toUTCString());

        if (isHead) {
            res.setHeader("Content-Length", 0);
            res.end();
            next();
        } else {
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
