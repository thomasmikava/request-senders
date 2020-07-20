import { deepMergeLeftToRight, defaultDataAndUrlValidator } from "./utils";
import { MethodType, RequestInfo, RequestOptions, ValidatorFn } from "./types";

export interface RequestSenderConfig<
	RawResponse extends unknown,
	Options extends RequestOptions<unknown>,
	Extra,
	AllowedMethodType = MethodType
> {
	urlPrefix?: string;
	defaultOptions: Options;
	onResponse?: (response: RawResponse) => void | any;
	onReject?: (
		error: any,
		args: readonly [
			AllowedMethodType,
			string,
			FormData | Record<any, any> | undefined | null,
			Options | undefined
		],
		requestSender: RequestSender<
			RawResponse,
			Options,
			Extra,
			AllowedMethodType
		>
	) => void | Promise<any>;
	preRequestHook?: (
		arg: RequestInfo<Options, AllowedMethodType>
	) =>
		| RequestInfo<Options, AllowedMethodType>
		| Promise<RequestInfo<Options, AllowedMethodType>>;
	validator?: ValidatorFn<
		Options["requestSchema"],
		Options["validationOptions"]
	>;
	encodeQuery?: (data: any) => string;
	dataAndUrlValidator?: (args: {
		method: AllowedMethodType;
		baseUrl: string;
		data?: FormData | Record<any, any> | null;
		urlPrefix: string;
		encodeQuery: (data: any) => string;
		options?: Options;
		validator?: ValidatorFn<
			Options["requestSchema"],
			Options["validationOptions"]
		>;
	}) => { requestArg: any; url: string };
	sendValidatedRequest(args: {
		method: AllowedMethodType;
		url: string;
		data: any;
		config: Options["requestConfig"];
	}): Promise<RawResponse>;
	mergeValidatedDataIntoResponse?: (
		rawResponse: RawResponse,
		validatedData: any
	) => RawResponse;
	mergeOptionsWithDefaultOptions?: (
		currentOptions: Options | undefined,
		defaultOptions: Options
	) => Options;
	getDataFromResponse: (rawResponse: RawResponse) => any;
	extra?: Extra;
}

export class RequestSender<
	RawResponse extends unknown,
	Options extends RequestOptions<any>,
	Extra,
	AllowedMethodType = MethodType
> {
	public defaultOptions: Options;

	private blockingRequest: Promise<any> | null = null;
	private urlPrefix: string;
	private onResponse?: (response: RawResponse) => void | any;
	private onReject: (
		error: any,
		args: readonly [
			AllowedMethodType,
			string,
			FormData | Record<any, any> | undefined | null,
			Options | undefined
		],
		requestSender: RequestSender<
			RawResponse,
			Options,
			Extra,
			AllowedMethodType
		>
	) => void | Promise<any>;
	private preRequestHook?: (
		arg: RequestInfo<Options, AllowedMethodType>
	) =>
		| RequestInfo<Options, AllowedMethodType>
		| Promise<RequestInfo<Options, AllowedMethodType>>;
	private validator?: ValidatorFn<
		Options["requestSchema"],
		Options["validationOptions"]
	>;
	private encodeQuery: (data: any) => string;
	private dataAndUrlValidator: (args: {
		method: AllowedMethodType;
		baseUrl: string;
		data?: FormData | Record<any, any> | null;
		options?: Options;
		urlPrefix: string;
		encodeQuery: (data: any) => string;
		validator?: ValidatorFn<
			Options["requestSchema"],
			Options["validationOptions"]
		>;
	}) => { requestArg: any; url: string };
	private sendValidatedRequest: (args: {
		method: AllowedMethodType;
		url: string;
		data: any;
		config: Options["requestConfig"];
	}) => Promise<RawResponse>;
	private mergeValidatedDataIntoResponse: (
		rawResponse: RawResponse,
		validatedData: any
	) => RawResponse;
	private mergeOptionsWithDefaultOptions: (
		currentOptions: Options | undefined,
		defaultOptions: Options
	) => Options;
	private getDataFromResponse: (rawResponse: RawResponse) => any;
	public extra: Extra;

	constructor({
		defaultOptions,
		urlPrefix = "",
		validator,
		onReject = defaultOnReject,
		onResponse,
		preRequestHook,
		sendValidatedRequest,
		encodeQuery = defaultEncodeURIComponent,
		mergeValidatedDataIntoResponse = defaultMergeValidatedDataIntoResponse as any,
		mergeOptionsWithDefaultOptions = defaultMergeOptionsWithDefaultOptions,
		dataAndUrlValidator,
		getDataFromResponse,
		extra,
	}: RequestSenderConfig<RawResponse, Options, Extra, AllowedMethodType>) {
		this.defaultOptions = defaultOptions;
		this.urlPrefix = urlPrefix;
		this.validator = validator;
		this.onReject = onReject;
		this.onResponse = onResponse;
		this.preRequestHook = preRequestHook;
		this.sendValidatedRequest = sendValidatedRequest;
		this.encodeQuery = encodeQuery;
		this.mergeValidatedDataIntoResponse = mergeValidatedDataIntoResponse;
		this.mergeOptionsWithDefaultOptions = mergeOptionsWithDefaultOptions;
		this.dataAndUrlValidator =
			dataAndUrlValidator || defaultDataAndUrlValidator;
		this.getDataFromResponse = getDataFromResponse;
		this.extra = extra!;
	}

	public async send(
		method: AllowedMethodType,
		baseUrl: string,
		data: FormData | Record<any, any> | undefined | null,
		options?: Options
	): Promise<any> {
		const args = [method, baseUrl, data, options] as const;
		try {
			let { url, requestArg } = this.dataAndUrlValidator({
				urlPrefix: this.urlPrefix,
				encodeQuery: this.encodeQuery,
				validator: this.validator,
				method,
				baseUrl,
				data,
				options,
			});

			let finalOptions = this.mergeOptionsWithDefaultOptions(
				options,
				this.defaultOptions
			);
			const startPromise =
				!this.blockingRequest || finalOptions.avoidBlockingRequest
					? Promise.resolve(null)
					: this.blockingRequest;
			await startPromise;

			if (this.preRequestHook) {
				({
					method,
					url,
					requestArg,
					options: finalOptions,
				} = await this.preRequestHook({
					method,
					url,
					requestArg,
					options: finalOptions,
				}));
			}
			const res = await this.sendValidatedRequest({
				method,
				url,
				data: requestArg,
				config: finalOptions.requestConfig,
			});
			if (this.onResponse) {
				this.onResponse(res);
			}
			const rawData = this.getDataFromResponse(res);
			const validatedData = this.validator
				? this.validator({
						data: rawData,
						type: "response",
						schema: finalOptions.responseSchema,
						options: finalOptions.validationOptions,
				  })
				: rawData;

			if (finalOptions.returnRawResponse) {
				return this.mergeValidatedDataIntoResponse(res, validatedData);
			} else {
				return validatedData;
			}
		} catch (err) {
			return this.onReject(err, args, this);
		}
	}

	public setBlockingRequest(promise: Promise<any> | null) {
		if (!promise) {
			this.blockingRequest = null;
			return;
		}
		const finalPromise = promise
			.then(data => {
				if (this.blockingRequest !== finalPromise) return data;
				this.blockingRequest = null;
				return data;
			})
			.catch(e => {
				if (this.blockingRequest !== finalPromise) return;
				this.blockingRequest = null;
				throw e;
			});
		this.blockingRequest = finalPromise;
	}
	public setBlockingRequestIfNotSet(promiseFn: () => Promise<any>) {
		if (!this.blockingRequest) this.setBlockingRequest(promiseFn());
		return this.blockingRequest!;
	}
	public getBlockingRequest() {
		return this.blockingRequest;
	}
	public wait() {
		return Promise.resolve(this.blockingRequest);
	}
}

const defaultOnReject = (e: any, args: readonly any[]) => {
	throw e;
};

function defaultEncodeURIComponent(str: any): string {
	if (Array.isArray(str)) {
		return JSON.stringify(
			str.map(x => {
				if (typeof x === "number") return x;
				return encodeURIComponent(x);
			})
		);
	} else if (str instanceof Date) {
		return encodeURIComponent(str.toJSON());
	} else if (str !== null && typeof str === "object") {
		return encodeURIComponent(JSON.stringify(str));
	}
	return encodeURIComponent(str);
}

const defaultMergeValidatedDataIntoResponse = <T extends { data: D }, D>(
	res: T,
	data: D
): T => {
	return { ...res, data };
};

const defaultMergeOptionsWithDefaultOptions = <T>(
	a: T | undefined,
	b: T
): T => {
	return deepMergeLeftToRight(a || {}, b);
};
