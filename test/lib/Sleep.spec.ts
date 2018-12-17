import Sleep from '../../src/lib/Sleep'

describe('Sleep unit test', () => {
    beforeEach(() => {
        Sleep.sleeps = {}
    })
    test('Create sleep without id', () => {
        Sleep.create().then()
        expect(Object.keys(Sleep.sleeps).length).toBe(1)
    })
    test('Expect sleep to be resolved after a second', () => {
        expect.assertions(1)
        const start = new Date().getTime()
        return Sleep.create(1000).then(() => {
            const end = new Date().getTime()
            expect((end - start) / 1000).toBeCloseTo(1, 1)
        })
    })
    test('Expect sleep to be canceled', () => {
        Sleep.create(5000, 'ID')
        Sleep.clear('ID')
        expect(Sleep.sleeps.ID._canceled).toBe(true)
    })
    test('Expect all sleeps like ID to be canceled', () => {
        expect.assertions(4)
        Sleep.create(1000, 'ID1')
        Sleep.create(1000, 'ID2')
        Sleep.create(1000, 'ID3')
        const sleep = Sleep.create(1000, 'NOT_TO_BE_CANCELED').then(() => {
            expect(true).toBe(true)
        })
        Sleep.clearAllBy('ID')
        expect(Sleep.sleeps.ID1._canceled).toBe(true)
        expect(Sleep.sleeps.ID2._canceled).toBe(true)
        expect(Sleep.sleeps.ID3._canceled).toBe(true)
        return sleep
    })
})
