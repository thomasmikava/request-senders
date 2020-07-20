export interface RequestOptions<
	RequestConfig,
	Schema = any,
	ValidationOption = any
> {
	requestSchema?: Schema;
	responseSchema?: Schema;
	validationOptions?: ValidationOption;
	requestConfig?: RequestConfig;
	avoidBlockingRequest?: boolean;
	returnRawResponse?: boolean;
}

export type ValidatorFn<Schema = any, ValidationOptions = any> = (args: {
	data: any;
	type: "request" | "response";
	schema?: Schema;
	options?: ValidationOptions;
}) => any;

export type MethodType =
	| "GET"
	| "POST"
	| "PUT"
	| "DELETE"
	| "HEAD"
	| "CONNECT"
	| "OPTIONS"
	| "TRACE";

export interface RequestInfo<Options, AllowedMethodType> {
	method: AllowedMethodType;
	url: string;
	requestArg: any;
	options: Options;
}
