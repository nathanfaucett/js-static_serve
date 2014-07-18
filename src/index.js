var fs = require("fs"),

    HttpError = require("http_error"),
    filePath = require("file_path");


function StaticServe(opts) {
    opts || (opts = {});

    this.root = this.normalizePath(opts.root || "/");
    this.rootLength = this.root.length;

    this.directory = this.normalizePath(opts.directory || "./");
    this.fullDirectory = filePath.join(cwd, directory);

    this.index = opts.index || "index.html";

    this.options = {
        maxAge: opts.maxAge || 86400000,
        fallback: opts.fallback != null ? !!opts.fallback : true,
        etag: opts.etag != null ? !!opts.etag : true
    };
}

StaticServe.prototype.normalizePath = function(path) {
    if (!path || typeof(path) !== "string") return ".";
    if (path === "/") return path;
    if (path[0] === "/") path = path.substr(1);
    if (path[path.length] === "/") path = path.substr(0, path.length);
    return path;
};

StaticServe.prototype.middleware = function(req, res, next) {
    var method = req.method,
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

    fileName = filePath.join(fullDirectory, url.substring(this.rootLength));

    fs.stat(fileName, function(err, stat) {
        if (!stat) {
            next();
            return;
        }
        if (err) {
            next(new HttpError(404, err));
            return;
        }
        if (stat.isDirectory()) {
            fileName = filePath.join(fileName, this.index);

            fs.stat(fileName, function(err, stat) {
                if (err || !stat) {
                    next(new HttpError(404, err));
                    return;
                }

                res.sendFile(fileName, this.options, function(err) {
                    if (err) {
                        next(err);
                        return;
                    }

                    next();
                });
            });
        } else {
            res.sendFile(fileName, this.options, function(err) {
                if (err) {
                    next(err);
                    return;
                }

                next();
            });
        }
    });
};


module.exports = StaticServe;
