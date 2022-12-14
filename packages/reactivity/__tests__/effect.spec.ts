import { test, expect, describe, it, vi } from 'vitest'
import { reactive, readonly, shallowReactive, shallowReadonly } from "../src/reactive";
import { effect } from "../src/effect"


describe.only('reactive', () => {


  /**
   * 分支切换,遗留的副作用函数,在每次调用run方法前执行cleanupEffect去清除依赖
   */
  test('分支切换', () => {
    const original = { ok: true, text: 'hello world' }
    const state = reactive(original)
    const fnSpy = vi.fn()
    effect(() => {
      state.ok ? state.text : 'not'
      fnSpy()
    })

    state.ok = false
    state.text = 'change'
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * effect嵌套问题,每一个effect内的响应式对象需要一一对应属于自己的effect
   */

  test('effect嵌套问题_2', () => {
    const original = { foo: 1, bar: 1 };
    const original2 = { bar: 1 };
    const state = reactive(original);
    const state2 = reactive(original2);
    effect(() => {
      state.foo;
      state2.bar++;
      // console.log(state.foo + "foo");
      effect(() => {
        // console.log(state2.bar + "infoo");
      });
      state.bar;
      // console.log(state.bar + "bar");
    });
    state.foo++;
    state.bar++;
    state2.bar++;// 这个触发四次 进去之后state2.foo++执行三次
    /**
    * 
    *
    1 foo
    2 infoo
    1 bar
    3 infoo
    2 foo
    3 infoo
    1 bar
    4 infoo
    2 foo
    4 infoo
    2 bar
    6 infoo
    2 foo
    6 infoo
    2 bar
    6 infoo
      * 
    */
  })

  /**
   * 存在for in循环的时候,用Symbol和副作用函数建立依赖关系,触发Add操作的时候,需要将这些副作用函数拿出来重新执行
   */
  test('for in', () => {
    const original = { foo: 1, bar: 1 }
    const state = reactive(original)
    const fnSpy = vi.fn()
    effect(() => {
      fnSpy()
      for (const key in state) {
      }
    })
    state.age = 3
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * 当读取 child.bar 属性值时，由于child 代理的对象 obj 自身没有 bar 属性，因此会获取对象 obj 的原型，也就是 parent 对象，所以最终得到的实际上是 parent.bar
   * 的值。但是大家不要忘了，parent 本身也是响应式数据，因此在副作用函数中访问 parent.bar 的值时，会导致副作用函数被收集，从而也建立响应联系。所以我们能够得出
   * 一个结论，即 child.bar 和parent.bar 都与副作用函数建立了响应联系。
   * 
   * 如果设置的属性不存在于对象上，那么会取得其原型，并调用原型的 [[Set]] 方法，也就是 parent 的 [[Set]] 内部方法。由于 parent 是代理对象，所以这就相当于执行了
   * 它的 set 拦截函数。换句话说，虽然我们操作的是 child.bar，但这也会导致 parent 代理对象的 set 拦截函数被执行。前面我们分析过，当读取child.bar 的值时，副作用
   * 函数不仅会被 child.bar 收集，也会被parent.bar 收集。所以当 parent 代理对象的 set 拦截函数执行时，就会触发副作用函数重新执行，这就是为什么修改 child.bar
   * 的值会导致副作用函数重新执行两次。
   * 
   *  child 的 set 拦截函数
   *  set(target, key, value, receiver) { 
   *     target 是原始对象 obj 
   *     receiver 是代理对象 child
   *  }
   * 
   *  parent 的 set 拦截函数
   *  set(target, key, value, receiver) { 
   *     target 是原始对象 proto 
   *     receiver 是代理对象 child
   *  }
   * 
   * 我们发现，当 parent 代理对象的 set 拦截函数执行时，此时 target 是原始对象 proto，而 receiver 仍然是代理对象 child，
   * 而不再是 target 的代理对象。通过这个特点，我们可以看到 target 和 receiver 的区别。由于我们最初设置的是 child.bar
   * 的值，所以无论在什么情况下，receiver 都是 child，而 target 则是变化的。根据这个区别，我们很容易想到解决办法，只需要判断
   * receiver 是否是 target 的代理对象即可。只有当 receiver 是 target 的代理对象时才触发更新，这样就能够屏蔽由原型引起的更新了。
   * 所以接下来的问题变成了如何确定 receiver 是不是 
   * 
   */
  test('原型链响应式-effect重复执行', () => {
    const obj = {}
    const proto = { bar: 1 }
    const child = reactive(obj)
    const parent = reactive(proto)
    // 使用 parent 作为 child 的原型
    Object.setPrototypeOf(child, parent)
    const fnSpy = vi.fn()
    effect(() => {
      fnSpy()
      child.bar
    })
    // 修改 child.bar 的值
    child.bar = 2 // 会导致副作用函数重新执行两次
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  // 深层次响应式
  test('深层响应式', () => {
    const original = { bar: { foo: 1 } }
    const state = reactive(original)
    const fnSpy = vi.fn()
    effect(() => {
      state.bar.foo;
      fnSpy()
    })
    state.bar.foo = 2
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * # 浅层次响应式
   * const obj = shallowReactive({ foo: { bar: 1 } })
   * effect(() => {
   *    console.log(obj.foo.bar)
   * })
   * obj.foo 是响应的，可以触发副作用函数重新执行
   *    obj.foo = { bar: 2 } 
   * obj.foo.bar 不是响应的，不能触发副作用函数重新执行
   *    obj.foo.bar = 3
   * 
   *  */
  test('浅层次响应式', () => {
    const obj = shallowReactive({ foo: { bar: 1 } })
    const fnSpy = vi.fn()
    effect(() => {
      obj.foo.bar
      fnSpy()
    })
    obj.foo.bar++
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })


  test('readonly and reactive', () => {
    const original = { foo: { bar: 1 } };
    const obj = reactive(original);
    const state = readonly(obj);
    const fnSpy = vi.fn()
    effect(() => {
      // state.foo 是通过 Reflect.get(target,key,receiver)拿不到的，此时的target是 obj,相当于obj.foo，返回的时候由于foo对应的值是一个对象，reactive返回的时候会进行包装
      // 因此返回的state.foo 首先是 reactive({bar:1}),由于最外层是readonly，最后返回的就是 readonly(reactive({bar:1}))
      // 总体下来就是 obj.foo 以及 reactive({bar:1}).bar，和effect建立了依赖关系，因此直接修改obj的属性，都会触发依赖更新
      state.foo.bar
      fnSpy()
    });
    obj.foo = { bar: 4 };
    obj.foo.bar++
    expect(fnSpy).toHaveBeenCalledTimes(3)
  })

  test('readonly and reactive2', () => {
    const original = { foo: { bar: 1 } };
    const obj = reactive(original);
    const state = readonly(obj);
    const fnSpy = vi.fn()
    effect(() => {
      // state.foo 是通过 Reflect.get(target,key,receiv er)拿不到的，此时的target是 obj,相当于obj.foo，返回的时候由于foo对应的值是一个对象，reactive返回的时候会进行包装
      // 因此返回的res 首先是 reactive({bar:1}),由于最外层是readonly，最后返回的就是 readonly(reactive({bar:1}))
      // 总体下来就是 obj.foo 以及 reactive({bar:1}).bar，和effect建立了依赖关系，因此直接修改obj的属性，都会触发依赖更新,但是直接修改state的属性值会警告
      state.foo.bar
      fnSpy()
    });
    state.foo.bar = 3;
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  test('shallowReadonly and reactive', () => {
    const original = { foo: { bar: 1 } };
    const obj = reactive(original);
    const state = shallowReadonly(obj);
    const fnSpy = vi.fn()
    effect(() => {
      // state.foo 是通过 Reflect.get(target,key,receiv er)拿不到的，此时的target是 obj,相当于obj.foo，返回的时候由于foo对应的值是一个对象，reactive返回的时候会进行包装
      // 因此返回的res 首先是 reactive({bar:1}),由于最外层是shallowReadonly，最后返回的就是 res
      // 总体下来就是 obj.foo 以及 reactive({bar:1}).bar，和effect建立了依赖关系，因此直接修改obj的属性，都会触发依赖更新，但是直接修改state最外层的属性值会警告，里层不会，因为返回res的时候没有用readonly包装
      state.foo.bar;
      fnSpy()
    });
    obj.foo.bar = 3;
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })


  /**
   * 首先数组实例的length属性建立和effect的依赖关系，然后我们在新增元素的时候，会取出和length有依赖关系的effect，重新执行
   */
  test('建立与数组长度的依赖关系，然后新增数组元素', () => {
    const original = ['foo']
    const state_array = reactive([original])
    const fnSpy = vi.fn()
    effect(() => {
      state_array.length
      fnSpy()
    })
    state_array[1] = 'bar'
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  test('修改数组长度，取出大于等于新设置的长度的effect重新执行', () => {
    const original = ['foo']
    const state_array = reactive([original])
    const fnSpy = vi.fn()
    effect(() => {
      state_array[0]
      fnSpy()
    })
    state_array.length = 0
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  test('for..in数组建立effect和length的依赖关系，涉及length的操作，应重新触发length相关的effect', () => {
    const original = ['foo']
    const state_array = reactive([original])
    const fnSpy = vi.fn()
    effect(() => {
      fnSpy()
      for (const key in state_array) {
      }

    })
    state_array[1] = 'bar'
    state_array.length = 0
    expect(fnSpy).toHaveBeenCalledTimes(3)
  })

  test('for..of数组，会访问索引和length，因此他们都会和effect建立依赖关系', () => {
    const original = ['foo']
    const state_array = reactive([original])
    const fnSpy = vi.fn()
    effect(() => {
      fnSpy()
      for (const item of state_array) {
      }
    })
    state_array[1] = 'bar'
    expect(fnSpy).toHaveBeenCalledTimes(2)
    state_array.length = 0
    expect(fnSpy).toHaveBeenCalledTimes(3)
  })

  test("避免污染数组的原始数据", () => {
    const originalArr = [];
    const arr = reactive(originalArr);
    arr[0] = reactive([1]);
    const fnSpy = vi.fn()
    effect(() => {
      fnSpy()
      originalArr[0].length;
    });
    originalArr[0].push(1);
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  // shallowReactive 设置值的时候不会进行toRaw操作
  test("shallowReactive可以(避免污染数组的原始数据)", () => {
    const originalArr = [];
    const arr = shallowReactive(originalArr);
    arr[0] = shallowReactive([1]);
    const fnSpy = vi.fn()
    effect(() => {
      originalArr[0].length;
      fnSpy()
    });
    originalArr[0].push(1);
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })
})

describe("effect 嵌套内存泄漏问题", () => {
  test('effect嵌套问题_1', () => {
    const original = { foo: 1, bar: 1 }
    const original2 = { bar: 1 }
    const state = reactive(original)
    const state2 = reactive(original2)
    const fnSpy1 = vi.fn()
    const fnSpy2 = vi.fn()
    effect(() => {
      state.foo
      fnSpy1()
      // console.log(state.foo + "foo");
      effect(() => {
        // 外层函数重新执行副作用函数间接执行里面这个副作用函数的时候有问题，又new ReactiveEffect(fn)实例，导致target.key始终存储着之前的effect
        // 发现源码也有这个问题
        // console.log(state2.bar + "infoo");
        state2.bar
        fnSpy2()
      })
      state.bar
      // console.log(state.bar + "bar");
    })
    state.foo++
    expect(fnSpy1).toHaveBeenCalledTimes(2)
    expect(fnSpy2).toHaveBeenCalledTimes(2)
    state.bar++
    expect(fnSpy1).toHaveBeenCalledTimes(3)
    expect(fnSpy2).toHaveBeenCalledTimes(3)
    state2.bar++
    expect(fnSpy1).toHaveBeenCalledTimes(3)
    expect(fnSpy2).toHaveBeenCalledTimes(4)
    // 期望应该变成4 但是变成了6，因为state2.bar 实际上收集了3个重复的依赖，但是由于是new出来，set无法去重
  })

  test('effect嵌套问题_3', () => {
    const original = { foo: 1, bar: 1 }
    const original2 = { bar: 1 }
    const state = reactive(original)
    const state2 = reactive(original2)
    const fnSpy1 = vi.fn()
    const fnSpy2 = vi.fn()
    effect(() => {
      state.foo
      fnSpy1()
      effect(() => {
        state2.bar
        effect(() => {
          fnSpy2()
        })
        fnSpy2()
      })
      state.bar
    })
    state.foo++
    expect(fnSpy1).toHaveBeenCalledTimes(2)
    expect(fnSpy2).toHaveBeenCalledTimes(4)
    state.bar++
    expect(fnSpy1).toHaveBeenCalledTimes(3)
    expect(fnSpy2).toHaveBeenCalledTimes(6)
    state2.bar++
    expect(fnSpy1).toHaveBeenCalledTimes(3)
    expect(fnSpy2).toHaveBeenCalledTimes(8)
    // 期望应该变成4 但是变成了6，因为state2.bar 实际上收集了3个重复的依赖，但是由于是new出来，set无法去重
  })

  test("内存泄漏", () => {
    const original = { foo: 1, bar: 1 }
    const original2 = { bar: 1 }
    const state = reactive(original)
    const state2 = reactive(original2)
    const fnSpy1 = vi.fn()
    const fnSpy2 = vi.fn()
    effect(() => {
      state.foo
      fnSpy1()
      // console.log(state.foo + "foo");
      effect(() => {
        // 外层函数重新执行副作用函数间接执行里面这个副作用函数的时候有问题，又new ReactiveEffect(fn)实例，导致target.key始终存储着之前的effect
        // 发现源码也有这个问题
        // console.log(state2.bar + "infoo");
        state2.bar
        fnSpy2()
      })
      state.bar
      // console.log(state.bar + "bar");
    })
    state.foo++
    expect(fnSpy1).toHaveBeenCalledTimes(2)
    expect(fnSpy2).toHaveBeenCalledTimes(2)
    state.bar++
    expect(fnSpy1).toHaveBeenCalledTimes(3)
    expect(fnSpy2).toHaveBeenCalledTimes(3)
    state2.bar++
    expect(fnSpy1).toHaveBeenCalledTimes(3)
    expect(fnSpy2).toHaveBeenCalledTimes(4)
  })
})