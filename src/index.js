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

    this.index = opts.index || "index.html";

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
        url = req.url,
        fileName;

    if (method !== "GET" && method !== "HEAD") {
        next();
        return;
    }
    if (url.indexOf(this.root) !== 0) {
        next();
        return;
    }

    fileName = filePath.join(this.fullDirectory, url.substring(this.rootLength));

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

StaticServe.prototype.send = function(res, fileName, stat, callback) {
    var app = res.app,
        opts = this.options,
        modified = false;

    fs.readFile(fileName, function(err, buffer) {
        if (err) {
            callback(new HttpError(err));
            return;
        }
        var ext = filePath.ext(fileName),
            type = app.mime.lookUpType(ext, opts.fallback);

        if (type) {
            modified = res.modified(stat.mtime);

            res.contentLength = type;
            if (opts.maxAge && !res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "public, max-age=" + (opts.maxAge / 1000));
            if (opts.etag && !res.getHeader("ETag")) res.setHeader("ETag", '"' + app.get("etag fn")(buffer) + '"');
            if (modified && opts.lastModified && !res.getHeader("Last-Modified")) res.setHeader("Last-Modified", new Date(stat.mtime));

            res.send(modified ? 200 : 304, buffer);
            callback();
            return;
        }

        callback(new HttpError(415, ext));
    });

    return this;
};


module.exports = StaticServe;
