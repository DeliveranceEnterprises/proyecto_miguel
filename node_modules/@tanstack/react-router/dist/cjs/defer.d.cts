import { defaultSerializeError } from './router.cjs';
export type DeferredPromiseState<T> = {
    uid: string;
    resolve?: () => void;
    promise?: Promise<void>;
    __resolvePromise?: () => void;
} & ({
    status: 'pending';
    data?: T;
    error?: unknown;
} | {
    status: 'success';
    data: T;
} | {
    status: 'error';
    data?: T;
    error: unknown;
});
export type DeferredPromise<T> = Promise<T> & {
    __deferredState: DeferredPromiseState<T>;
};
export declare function defer<T>(_promise: Promise<T>, options?: {
    serializeError?: typeof defaultSerializeError;
}): DeferredPromise<T>;
export declare function isDehydratedDeferred(obj: any): boolean;
