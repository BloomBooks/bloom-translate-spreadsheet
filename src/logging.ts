let isVerbose = false;

export function setVerbose(value: boolean) {
    isVerbose = value;
}
export function log(message: string) {
    console.log(message);
}

export function verbose(message: string) {
    if (isVerbose) {
        console.log(message);
    }
}
