
function wrap(f, ...args) {
    return new Promise((resolve, reject) => {
        f(...args, resolve, reject);
    });
}

function bindWrap(f, context, ...args) {
    return wrap(f.bind(context), ...args);
}

module.exports = {
    wrap,
    bindWrap
};
