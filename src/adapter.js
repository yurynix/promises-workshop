const Promise = undefined
const { createAdapter } = require("./createAdapter")

class MyPromise {
  constructor(callback) {
    this.value = undefined;
    this.state = 'pending';
    this.resolveOrRejectCalled = false;
    this.thenCallbacks = [];

    const setValue = (value, stateName) => {
      if (this.state === 'pending') {
        this.value = value;
        this.state = stateName;
      }
    }

    const resolve = (value) => {
      if (this.resolveOrRejectCalled) {
        return;
      }
      this.resolveOrRejectCalled = true;


      if (!value) {
        setValue(value, 'resolved');
        this._processThenCallbacks();
        return;
      }

      if (typeof value === 'boolean' || typeof value === 'number') {
        setValue(value, 'resolved');
        this._processThenCallbacks();
        return;
      }

      const tryResolve = (resolveValue) => {
        let handlerCalled = false;
        try {
          const onFulfilled = (v) => {
            if (handlerCalled) {
              return;
            }
            handlerCalled = true;
            tryResolve(v);
            //setValue(value, 'resolved');
          }
    
          const onRejected = (r) => {
            if (handlerCalled) {
              return;
            }
            handlerCalled = true;
            setValue(r, 'rejected');
            this._processThenCallbacks();
          }
    
          resolveValue.then(onFulfilled, onRejected);
        } catch (ex) {
          if (handlerCalled) {
            return;
          }
          if (ex && ex.message && (ex.message.indexOf('then is not a function') > -1 || ex.message.indexOf(`Cannot read property 'then'`) > -1)) {
            setValue(resolveValue, 'resolved');
          } else {
            setValue(ex, 'rejected');
          }

          this._processThenCallbacks();
        }
      }

      tryResolve(value);
    }

    const reject = (reason) => {
      if (this.resolveOrRejectCalled) {
        return;
      }
      this.resolveOrRejectCalled = true;

      if (!reason) {
        setValue(reason, 'rejected');
        this._processThenCallbacks();
        return;
      }

      setValue(reason, 'rejected');
      this._processThenCallbacks();
    }

    try {
      callback(resolve, reject)
    } catch (ex) {
      reject(ex);
    }

  }

  then(onFulfilled, onRejected) {
    let nextPHandlers;

    const nextP = new MyPromise((resolve, reject) => {
      nextPHandlers = {
        resolve,
        reject,
      };
    });

    this.thenCallbacks.push({
      onFulfilled,
      onRejected,
      nextPHandlers: {
        nextP,
        ...nextPHandlers,
      },
    });

    this._processThenCallbacks();

    return nextP;
  }

  _processThenCallbacks() {
    if (this.state !== 'pending') {
      this.thenCallbacks.forEach(({ onFulfilled, onRejected, nextPHandlers }) => {
        setImmediate(() => {
          debugger;
          if (this.state === 'rejected') {
            if (typeof onRejected === 'function') {
              try {
                const rejectedValue = onRejected(this.value);
                if (rejectedValue === this || rejectedValue === nextPHandlers.nextP) {
                  throw new TypeError('Circular promise detected');
                }
                nextPHandlers.resolve(rejectedValue);
                return;
              } catch (ex) {
                nextPHandlers.reject(ex);
                return;
              }
            }

            nextPHandlers.reject(this.value);
          } else if (this.state === 'resolved') {
            if (typeof onFulfilled === 'function') {
              try {
                const fulfiledResult = onFulfilled(this.value);
                if (fulfiledResult === this || fulfiledResult === nextPHandlers.nextP) {
                  throw new TypeError('Circular promise detected');
                }
                nextPHandlers.resolve(fulfiledResult);
                return;
              } catch (ex) {
                nextPHandlers.reject(ex);
                return;
              }
            }

            nextPHandlers.resolve(this.value);
          }
        });
      });

      this.thenCallbacks = [];
    }
  }
}

module.exports = {
  myAdapter: createAdapter(MyPromise),
  MyPromise,
}
