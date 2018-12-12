export default interface TaskOptions {
    accept: (message?: string) => boolean,
    finished: boolean,
    promise: Promise<string>,
    reject: (message: string) => Error,
    task: string,
    options: {expectedReturn: string}
}
