declare module 'cancelable-promise' {
    export class CancelablePromise {
        public static all(iterable: Iterable<any>): CancelablePromise

        public static race(iterable: Iterable<any>): CancelablePromise

        public static reject(value: any): CancelablePromise

        public static resolve(value: any): CancelablePromise

        constructor(executor: any)

        public then(success: any, error?: any): CancelablePromise

        public catch(error: any): CancelablePromise

        public cancel(errorCallback: any): CancelablePromise
    }
}
