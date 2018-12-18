export default interface Options {
    pinCode?: string|number,
    retry?: number,
    removeDeviceEcho?: boolean,
    smsQueueWaitTime?: number,
    timeout?: number
}
