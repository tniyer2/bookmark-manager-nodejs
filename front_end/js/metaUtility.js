
const TagCounter = (function(){
    let proto = "__proto__";

    return class{
        constructor()
        {
            this._master = Object.create(null);
            this._protoCount = 0;
        }

        get tags()
        {
            let keys = Object.keys(this._master);
            if (this._protoCount > 0)
            {
                keys.push(proto);
            }
            return keys;
        }

        increment(keys)
        {
            keys.forEach(this._increment.bind(this));
        }

        decrement(keys)
        {
            keys.forEach(this._decrement.bind(this));
        }

        _increment(key)
        {
            if (key === proto)
            {
                this._protoCount += 1;
            }
            else if (!(key in this._master))
            {
                this._master[key] = 1;
            }
            else
            {
                this._master[key] += 1;
            }
        }

        _decrement(key)
        {
            if (key === proto)
            {
                if (this._protoCount > 0)
                {
                    this._protoCount -= 1;
                }
                else
                {
                    /*ignore*/
                }
            }
            else if (key in this._master)
            {
                if (this._master[key] === 1)
                {
                    delete this._master[key];
                }
                else
                {
                    this._master[key] -= 1;
                }
            }
            else
            {
                /*ignore*/
            }
        }
    };
})();

export { TagCounter };
