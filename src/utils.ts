import { RequestOptions, ValidatorFn } from "./types";

// overrideLeftToRight
export function deepMergeLeftToRight<
	T1 extends Record<any, any>,
	T2 extends Record<any, any>
>(object1: T1, object2: T2): T1 & T2 {
	const obj1 = { ...object1 } as any;
	for (const p in object2) {
		if (!object2.hasOwnProperty(p)) continue;
		if (object2[p] === obj1[p]) continue;
		if (!obj1.hasOwnProperty(p)) {
			if (object2[p] !== undefined) {
				obj1[p] = object2[p];
			}
			continue;
		}

		if (object2[p].constructor === Object) {
			obj1[p] = deepMergeLeftToRight(obj1[p], object2[p]) as any;
		} else if (!obj1.hasOwnProperty(p)) {
			obj1[p] = object2[p] as any;
		}
		if (obj1[p] === undefined) delete obj1[p];
	}

	return obj1;
}

export const defaultDataAndUrlValidator = <
	Options extends RequestOptions<unknown>,
	AllowedMethodType
>({
	urlPrefix,
	method,
	baseUrl,
	data,
	options,
	encodeQuery,
	buildQuery = defaultBuildQuery,
	validator,
}: {
	urlPrefix: string;
	method: AllowedMethodType;
	baseUrl: string;
	data?: FormData | Record<any, any> | null;
	options?: Options;
	encodeQuery: (data: any) => string;
	validator?: ValidatorFn<
		Options["requestSchema"],
		Options["validationOptions"]
	>;
	buildQuery?: (method: AllowedMethodType) => boolean;
}) => {
	let requestArg = Array.isArray(data)
		? [...data]
		: data instanceof FormData
		? {}
		: { ...(data || {}) };
	if (data instanceof FormData) {
		data.forEach((val, key) => {
			requestArg[key] = val;
		});
	}
	if (options && options.requestSchema) {
		requestArg = validator
			? validator({
					data: requestArg,
					type: "request",
					schema: options.requestSchema,
					options: options.validationOptions,
			  })
			: requestArg;
	}

	// example: api/resource/:id/ => api/resource/7/
	baseUrl = baseUrl.replace(/:([^/\s]+)/g, (str, match) => {
		if (requestArg[match] !== undefined) {
			const val = requestArg[match];
			delete requestArg[match];
			return val;
		}
		return str;
	});
	baseUrl = urlPrefix + baseUrl;
	let url = baseUrl;
	if (buildQuery(method)) {
		let queryString = "";
		if (typeof requestArg === "object" && requestArg !== null) {
			queryString =
				"?" +
				Object.keys(requestArg)
					.filter(key => requestArg[key] !== undefined)
					.map(key => key + "=" + encodeQuery(requestArg[key]))
					.join("&");
			if (queryString.length === 1) {
				queryString = "";
			}
		}
		url = baseUrl + queryString;
	}
	if (data instanceof FormData) {
		requestArg = data;
	}
	return { requestArg, url };
};

const defaultBuildQuery = (method: any): boolean => {
	if (typeof method !== "string") return false;
	return method.toLowerCase() === "get" || method.toLowerCase() === "delete";
};
