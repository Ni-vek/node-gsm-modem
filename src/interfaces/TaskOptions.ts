export default interface TaskOptions {
    accept?: (value?: {} | PromiseLike<{}> | undefined) => void,
    canBeFinished: boolean,
    finished: boolean,
    promise: Promise<{}>,
    reject?: (message?: any) => void,
    task: string,
    options: {expectedReturn: RegExp, postProcessFunction?: (data: string[]) => any}
}
