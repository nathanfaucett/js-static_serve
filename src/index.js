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
        fallback: opts.fallback != null ? !!opts.fallback : true,
        etag: opts.etag != null ? !!opts.etag : true
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
        if (!stat) {
            next();
            return;
        }
        if (err) {
            next(new HttpError(404, err));
            return;
        }
        if (stat.isDirectory()) {
            fileName = filePath.join(fileName, _this.index);

            fs.stat(fileName, function(err, stat) {
                if (err || !stat) {
                    next(new HttpError(404, err));
                    return;
                }

                res.sendFile(fileName, _this.options, function(err) {
                    if (err) {
                        next(err);
                        return;
                    }

                    next();
                });
            });
        } else {
            res.sendFile(fileName, _this.options, function(err) {
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
