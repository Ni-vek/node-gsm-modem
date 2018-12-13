import SmsModem from '../src/main'

describe('Constructor', () => {
  it('sets port value', () => {
    const l = new SmsModem('bar')

    expect(l.port).toBe('bar')
  })
})
//
// describe('setFoo', () => {
//   it('sets foo value', () => {
//     const l = new Library('bar')
//     l.setFoo('baz')
//
//     expect(l.getFoo()).toBe('baz')
//   })
// })
