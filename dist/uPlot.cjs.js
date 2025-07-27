/**
* Copyright (c) 2025, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* uPlot.js (μPlot)
* A small, fast chart for time series, lines, areas, ohlc & bars
* https://github.com/leeoniya/uPlot (v1.6.32)
*/

'use strict';

const FEAT_TIME          = true;

const FEAT_POINTS        = true;

const FEAT_PATHS         = true;

// binary search for index of closest value
function closestIdx(num, arr, lo, hi) {
	let mid;
	lo = lo || 0;
	hi = hi || arr.length - 1;
	let bitwise = hi <= 2147483647;

	while (hi - lo > 1) {
		mid = bitwise ? (lo + hi) >> 1 : floor((lo + hi) / 2);

		if (arr[mid] < num)
			lo = mid;
		else
			hi = mid;
	}

	if (num - arr[lo] <= arr[hi] - num)
		return lo;

	return hi;
}

function makeIndexOfs(predicate) {
	 let indexOfs = (data, _i0, _i1) => {
		let i0 = -1;
		let i1 = -1;

		for (let i = _i0; i <= _i1; i++) {
			if (predicate(data[i])) {
				i0 = i;
				break;
			}
		}

		for (let i = _i1; i >= _i0; i--) {
			if (predicate(data[i])) {
				i1 = i;
				break;
			}
		}

		return [i0, i1];
	 };

	 return indexOfs;
}

const notNullish = v => v != null;

const nonNullIdxs = makeIndexOfs(notNullish);

function rangeLog(min, max, base, fullMags) {
	if (base == 2)
		fullMags = true;

	let minSign = sign(min);
	let maxSign = sign(max);

	if (min == max) {
		if (minSign == -1) {
			min *= base;
			max /= base;
		}
		else {
			min /= base;
			max *= base;
		}
	}

	let logFn = base == 10 ? log10 : log2;

	let growMinAbs = minSign == 1 ? floor : ceil;
	let growMaxAbs = maxSign == 1 ? ceil : floor;

	let minLogAbs = logFn(abs(min));
	let maxLogAbs = logFn(abs(max));

	let minExp = growMinAbs(minLogAbs);
	let maxExp = growMaxAbs(maxLogAbs);

	let minIncr = pow(base, minExp);
	let maxIncr = pow(base, maxExp);

	// fix values like Math.pow(10, -5) === 0.000009999999999999999
	if (base == 10) {
		if (minExp < 0)
			minIncr = roundDec(minIncr, -minExp);
		if (maxExp < 0)
			maxIncr = roundDec(maxIncr, -maxExp);
	}

	if (fullMags) {
		min = minIncr * minSign;
		max = maxIncr * maxSign;
	}
	else {
		min = incrRoundDn(min, pow(base, floor(minLogAbs)), false);
		max = incrRoundUp(max, pow(base, floor(maxLogAbs)), false);
	}

	return [min, max];
}

function rangeAsinh(min, max, base, fullMags) {
	let minMax = rangeLog(min, max, base, fullMags);

	if (min == 0)
		minMax[0] = 0;

	if (max == 0)
		minMax[1] = 0;

	return minMax;
}

const rangePad = 0.1;

const autoRangePart = {
	mode: 3,
	pad: rangePad,
};

const _eqRangePart = {
	pad:  0,
	soft: null,
	mode: 0,
};

const _eqRange = {
	min: _eqRangePart,
	max: _eqRangePart,
};

// this ensures that non-temporal/numeric y-axes get multiple-snapped padding added above/below
// TODO: also account for incrs when snapping to ensure top of axis gets a tick & value
function rangeNum(_min, _max, mult, extra) {
	if (isObj(mult))
		return _rangeNum(_min, _max, mult);

	_eqRangePart.pad  = mult;
	_eqRangePart.soft = extra ? 0 : null;
	_eqRangePart.mode = extra ? 3 : 0;

	return _rangeNum(_min, _max, _eqRange);
}

// nullish coalesce
function ifNull(lh, rh) {
	return lh == null ? rh : lh;
}

function _rangeNum(_min, _max, cfg) {
	let cmin = cfg.min;
	let cmax = cfg.max;

	let padMin = ifNull(cmin.pad, 0);
	let padMax = ifNull(cmax.pad, 0);

	let hardMin = ifNull(cmin.hard, -inf);
	let hardMax = ifNull(cmax.hard,  inf);

	let softMin = ifNull(cmin.soft,  inf);
	let softMax = ifNull(cmax.soft, -inf);

	let softMinMode = ifNull(cmin.mode, 0);
	let softMaxMode = ifNull(cmax.mode, 0);

	let delta = _max - _min;
	let deltaMag = log10(delta);

	let scalarMax = max(abs(_min), abs(_max));
	let scalarMag = log10(scalarMax);

	let scalarMagDelta = abs(scalarMag - deltaMag);

	// this handles situations like 89.7, 89.69999999999999
	// by assuming 0.001x deltas are precision errors
//	if (delta > 0 && delta < abs(_max) / 1e3)
//		delta = 0;

	// treat data as flat if delta is less than 1e-24
	// or range is 11+ orders of magnitude below raw values, e.g. 99999999.99999996 - 100000000.00000004
	if (delta < 1e-24 || scalarMagDelta > 10) {
		delta = 0;

		// if soft mode is 2 and all vals are flat at 0, avoid the 0.1 * 1e3 fallback
		// this prevents 0,0,0 from ranging to -100,100 when softMin/softMax are -1,1
		if (_min == 0 || _max == 0) {
			delta = 1e-24;

			if (softMinMode == 2 && softMin != inf)
				padMin = 0;

			if (softMaxMode == 2 && softMax != -inf)
				padMax = 0;
		}
	}

	let nonZeroDelta = delta || scalarMax || 1e3;
	let mag          = log10(nonZeroDelta);
	let base         = pow(10, floor(mag));

	let _padMin  = nonZeroDelta * (delta == 0 ? (_min == 0 ? .1 : 1) : padMin);
	let _newMin  = roundDec(incrRoundDn(_min - _padMin, base/10), 24);
	let _softMin = _min >= softMin && (softMinMode == 1 || softMinMode == 3 && _newMin <= softMin || softMinMode == 2 && _newMin >= softMin) ? softMin : inf;
	let minLim   = max(hardMin, _newMin < _softMin && _min >= _softMin ? _softMin : min(_softMin, _newMin));

	let _padMax  = nonZeroDelta * (delta == 0 ? (_max == 0 ? .1 : 1) : padMax);
	let _newMax  = roundDec(incrRoundUp(_max + _padMax, base/10), 24);
	let _softMax = _max <= softMax && (softMaxMode == 1 || softMaxMode == 3 && _newMax >= softMax || softMaxMode == 2 && _newMax <= softMax) ? softMax : -inf;
	let maxLim   = min(hardMax, _newMax > _softMax && _max <= _softMax ? _softMax : max(_softMax, _newMax));

	if (minLim == maxLim && minLim == 0)
		maxLim = 100;

	return [minLim, maxLim];
}

// alternative: https://stackoverflow.com/a/2254896
const numFormatter = new Intl.NumberFormat();
const fmtNum = val => numFormatter.format(val);

const M = Math;

const PI = M.PI;
const abs = M.abs;
const floor = M.floor;
const round = M.round;
const ceil = M.ceil;
const min = M.min;
const max = M.max;
const pow = M.pow;
const sign = M.sign;
const log10 = M.log10;
const log2 = M.log2;
const asinh = (v, linthresh = 1) => M.asinh(v / linthresh);

const inf = Infinity;

function numIntDigits(x) {
	return (log10((x ^ (x >> 31)) - (x >> 31)) | 0) + 1;
}

function clamp(num, _min, _max) {
	return min(max(num, _min), _max);
}

function isFn(v) {
	return typeof v == "function";
}

function fnOrSelf(v) {
	return isFn(v) ? v : () => v;
}

const noop = () => {};

// note: these identity fns may get deoptimized if reused for different arg types
// a TS version would enforce they stay monotyped and require making variants
const retArg0 = _0 => _0;

const retArg1 = (_0, _1) => _1;

const retNull = _ => null;

const regex6 = /\.\d*?(?=9{6,}|0{6,})/gm;

// e.g. 17999.204999999998 -> 17999.205
const fixFloat = val => {
	if (isInt(val) || fixedDec.has(val))
		return val;

	const str = `${val}`;

	const match = str.match(regex6);

	if (match == null)
		return val;

	let len = match[0].length - 1;

	// e.g. 1.0000000000000001e-24
	if (str.indexOf('e-') != -1) {
		let [num, exp] = str.split('e');
		return +`${fixFloat(num)}e${exp}`;
	}

	return roundDec(val, len);
};

function incrRound(num, incr, _fixFloat = true) {
	return _fixFloat ? fixFloat(roundDec(fixFloat(num/incr))*incr) : roundDec(num/incr)*incr;
}

function incrRoundUp(num, incr, _fixFloat = true) {
	return _fixFloat ? fixFloat(ceil(fixFloat(num/incr))*incr) : ceil(num/incr)*incr;
}

function incrRoundDn(num, incr, _fixFloat = true) {
	return _fixFloat ? fixFloat(floor(fixFloat(num/incr))*incr) : floor(num/incr)*incr;
}

// https://stackoverflow.com/a/48764436
// rounds half away from zero
function roundDec(val, dec = 0) {
	if (isInt(val))
		return val;
//	else if (dec == 0)
//		return round(val);

	let p = 10 ** dec;
	let n = (val * p) * (1 + Number.EPSILON);
	return round(n) / p;
}

const fixedDec = new Map();

function guessDec(num) {
	return ((""+num).split(".")[1] || "").length;
}

function genIncrs(base, minExp, maxExp, mults) {
	let incrs = [];

	let multDec = mults.map(guessDec);

	for (let exp = minExp; exp < maxExp; exp++) {
		let expa = abs(exp);
		let mag = roundDec(pow(base, exp), expa);

		for (let i = 0; i < mults.length; i++) {
			let _incr = base == 10 ? +`${mults[i]}e${exp}` : mults[i] * mag;
			let dec = (exp >= 0 ? 0 : expa) + (exp >= multDec[i] ? 0 : multDec[i]);
			let incr = base == 10 ? _incr : roundDec(_incr, dec);
			incrs.push(incr);
			fixedDec.set(incr, dec);
		}
	}

	return incrs;
}

//export const assign = Object.assign;

const EMPTY_OBJ = {};
const EMPTY_ARR = [];

const nullNullTuple = [null, null];

const isArr = Array.isArray;
const isInt = Number.isInteger;
const isUndef = v => v === void 0;

function isStr(v) {
	return typeof v == 'string';
}

function isObj(v) {
	let is = false;

	if (v != null) {
		let c = v.constructor;
		is = c == null || c == Object;
	}

	return is;
}

const TypedArray = Object.getPrototypeOf(Uint8Array);

const __proto__ = "__proto__";

function copy(o, _isObj = isObj) {
	let out;

	if (isArr(o)) {
		let val = o.find(v => v != null);

		if (isArr(val) || _isObj(val)) {
			out = Array(o.length);
			for (let i = 0; i < o.length; i++)
				out[i] = copy(o[i], _isObj);
		}
		else
			out = o.slice();
	}
	else if (o instanceof TypedArray) // also (ArrayBuffer.isView(o) && !(o instanceof DataView))
		out = o.slice();
	else if (_isObj(o)) {
		out = {};
		for (let k in o) {
			if (k != __proto__)
				out[k] = copy(o[k], _isObj);
		}
	}
	else
		out = o;

	return out;
}

function assign(targ) {
	let args = arguments;

	for (let i = 1; i < args.length; i++) {
		let src = args[i];

		for (let key in src) {
			if (key != __proto__) {
				if (isObj(targ[key]))
					assign(targ[key], copy(src[key]));
				else
					targ[key] = copy(src[key]);
			}
		}
	}

	return targ;
}

// nullModes
const NULL_REMOVE = 0;  // nulls are converted to undefined (e.g. for spanGaps: true)
const NULL_RETAIN = 1;  // nulls are retained, with alignment artifacts set to undefined (default)
const NULL_EXPAND = 2;  // nulls are expanded to include any adjacent alignment artifacts

// sets undefined values to nulls when adjacent to existing nulls (minesweeper)
function nullExpand(yVals, nullIdxs, alignedLen) {
	for (let i = 0, xi, lastNullIdx = -1; i < nullIdxs.length; i++) {
		let nullIdx = nullIdxs[i];

		if (nullIdx > lastNullIdx) {
			xi = nullIdx - 1;
			while (xi >= 0 && yVals[xi] == null)
				yVals[xi--] = null;

			xi = nullIdx + 1;
			while (xi < alignedLen && yVals[xi] == null)
				yVals[lastNullIdx = xi++] = null;
		}
	}
}

// nullModes is a tables-matched array indicating how to treat nulls in each series
// output is sorted ASC on the joined field (table[0]) and duplicate join values are collapsed
function join(tables, nullModes) {
	if (allHeadersSame(tables)) {
	//	console.log('cheap join!');

		let table = tables[0].slice();

		for (let i = 1; i < tables.length; i++)
			table.push(...tables[i].slice(1));

		if (!isAsc(table[0]))
			table = sortCols(table);

		return table;
	}

	let xVals = new Set();

	for (let ti = 0; ti < tables.length; ti++) {
		let t = tables[ti];
		let xs = t[0];
		let len = xs.length;

		for (let i = 0; i < len; i++)
			xVals.add(xs[i]);
	}

	let data = [Array.from(xVals).sort((a, b) => a - b)];

	let alignedLen = data[0].length;

	let xIdxs = new Map();

	for (let i = 0; i < alignedLen; i++)
		xIdxs.set(data[0][i], i);

	for (let ti = 0; ti < tables.length; ti++) {
		let t = tables[ti];
		let xs = t[0];

		for (let si = 1; si < t.length; si++) {
			let ys = t[si];

			let yVals = Array(alignedLen).fill(undefined);

			let nullMode = nullModes ? nullModes[ti][si] : NULL_RETAIN;

			let nullIdxs = [];

			for (let i = 0; i < ys.length; i++) {
				let yVal = ys[i];
				let alignedIdx = xIdxs.get(xs[i]);

				if (yVal === null) {
					if (nullMode != NULL_REMOVE) {
						yVals[alignedIdx] = yVal;

						if (nullMode == NULL_EXPAND)
							nullIdxs.push(alignedIdx);
					}
				}
				else
					yVals[alignedIdx] = yVal;
			}

			nullExpand(yVals, nullIdxs, alignedLen);

			data.push(yVals);
		}
	}

	return data;
}

// TODO: https://github.com/dy/sort-ids (~2x faster for 1e5+ arrays)
function sortCols(table) {
	let head = table[0];
	let rlen = head.length;

	let idxs = Array(rlen);
	for (let i = 0; i < idxs.length; i++)
		idxs[i] = i;

	idxs.sort((i0, i1) => head[i0] - head[i1]);

	let table2 = [];
	for (let i = 0; i < table.length; i++) {
		let row = table[i];
		let row2 = Array(rlen);

		for (let j = 0; j < rlen; j++)
			row2[j] = row[idxs[j]];

		table2.push(row2);
	}

	return table2;
}

// test if we can do cheap join (all join fields same)
function allHeadersSame(tables) {
	let vals0 = tables[0][0];
	let len0 = vals0.length;

	for (let i = 1; i < tables.length; i++) {
		let vals1 = tables[i][0];

		if (vals1.length != len0)
			return false;

		if (vals1 != vals0) {
			for (let j = 0; j < len0; j++) {
				if (vals1[j] != vals0[j])
					return false;
			}
		}
	}

	return true;
}

function isAsc(vals, samples = 100) {
	const len = vals.length;

	// empty or single value
	if (len <= 1)
		return true;

	// skip leading & trailing nullish
	let firstIdx = 0;
	let lastIdx = len - 1;

	while (firstIdx <= lastIdx && vals[firstIdx] == null)
		firstIdx++;

	while (lastIdx >= firstIdx && vals[lastIdx] == null)
		lastIdx--;

	// all nullish or one value surrounded by nullish
	if (lastIdx <= firstIdx)
		return true;

	const stride = max(1, floor((lastIdx - firstIdx + 1) / samples));

	for (let prevVal = vals[firstIdx], i = firstIdx + stride; i <= lastIdx; i += stride) {
		const v = vals[i];

		if (v != null) {
			if (v <= prevVal)
				return false;

			prevVal = v;
		}
	}

	return true;
}

const pre = "u-";

const UPLOT          =       "uplot";
const ORI_HZ         = pre + "hz";
const ORI_VT         = pre + "vt";
const TITLE          = pre + "title";
const WRAP           = pre + "wrap";
const UNDER          = pre + "under";
const OVER           = pre + "over";
const AXIS           = pre + "axis";
const OFF            = pre + "off";
const CURSOR_X       = pre + "cursor-x";
const CURSOR_Y       = pre + "cursor-y";
const CURSOR_PT      = pre + "cursor-pt";
const LEGEND         = pre + "legend";
const LEGEND_SERIES  = pre + "series";
const LEGEND_MARKER  = pre + "marker";
const LEGEND_LABEL   = pre + "label";
const LEGEND_VALUE   = pre + "value";

const WIDTH       = "width";
const HEIGHT      = "height";
const TOP         = "top";
const BOTTOM      = "bottom";
const LEFT        = "left";
const RIGHT       = "right";
const hexBlack    = "#000";
const transparent = hexBlack + "0";

const mousemove   = "mousemove";
const mousedown   = "mousedown";
const mouseup     = "mouseup";
const mouseenter  = "mouseenter";
const mouseleave  = "mouseleave";
const dblclick    = "dblclick";
const resize      = "resize";
const scroll      = "scroll";

const change      = "change";
const dppxchange  = "dppxchange";

const LEGEND_DISP = "--";

const domEnv = typeof window != 'undefined';

const doc = domEnv ? document  : null;
const win = domEnv ? window    : null;

let pxRatio;

//export const canHover = domEnv && !win.matchMedia('(hover: none)').matches;

let query;

function setPxRatio() {
	let _pxRatio = devicePixelRatio;

	// during print preview, Chrome fires off these dppx queries even without changes
	if (pxRatio != _pxRatio) {
		pxRatio = _pxRatio;

		query && off(change, query, setPxRatio);
		query = matchMedia(`(min-resolution: ${pxRatio - 0.001}dppx) and (max-resolution: ${pxRatio + 0.001}dppx)`);
		on(change, query, setPxRatio);

		win.dispatchEvent(new CustomEvent(dppxchange));
	}
}

function addClass(el, c) {
	if (c != null) {
		let cl = el.classList;
		!cl.contains(c) && cl.add(c);
	}
}

function remClass(el, c) {
	let cl = el.classList;
	cl.contains(c) && cl.remove(c);
}

function setStylePx(el, name, value) {
	el.style[name] = value + "px";
}

function placeTag(tag, cls, targ, refEl) {
	let el = doc.createElement(tag);

	if (cls != null)
		addClass(el, cls);

	if (targ != null)
		targ.insertBefore(el, refEl);

	return el;
}

function placeDiv(cls, targ) {
	return placeTag("div", cls, targ);
}

const xformCache = new WeakMap();

function elTrans(el, xPos, yPos, xMax, yMax) {
	let xform = "translate(" + xPos + "px," + yPos + "px)";
	let xformOld = xformCache.get(el);

	if (xform != xformOld) {
		el.style.transform = xform;
		xformCache.set(el, xform);

		if (xPos < 0 || yPos < 0 || xPos > xMax || yPos > yMax)
			addClass(el, OFF);
		else
			remClass(el, OFF);
	}
}

const sizeCache = new WeakMap();

function elSize(el, newWid, newHgt, centered) {
	let newSize = newWid + "" + newHgt;
	let oldSize = sizeCache.get(el);

	if (newSize != oldSize) {
		sizeCache.set(el, newSize);
		el.style.height = newHgt + "px";
		el.style.width = newWid + "px";
		el.style.marginLeft = -newWid/2 + "px" ;
		el.style.marginTop = -newHgt/2 + "px" ;
	}
}

const evOpts = {passive: true};
const evOpts2 = {...evOpts, capture: true};

function on(ev, el, cb, capt) {
	el.addEventListener(ev, cb, capt ? evOpts2 : evOpts);
}

function off(ev, el, cb, capt) {
	el.removeEventListener(ev, cb, capt ? evOpts2 : evOpts);
}

domEnv && setPxRatio();

const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const days = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

function slice3(str) {
	return str.slice(0, 3);
}

const days3 = days.map(slice3);

const months3 = months.map(slice3);

const engNames = {
	MMMM: months,
	MMM:  months3,
	WWWW: days,
	WWW:  days3,
};

function zeroPad2(int) {
	return (int < 10 ? '0' : '') + int;
}

function zeroPad3(int) {
	return (int < 10 ? '00' : int < 100 ? '0' : '') + int;
}

/*
function suffix(int) {
	let mod10 = int % 10;

	return int + (
		mod10 == 1 && int != 11 ? "st" :
		mod10 == 2 && int != 12 ? "nd" :
		mod10 == 3 && int != 13 ? "rd" : "th"
	);
}
*/

const subs = {
	// 2019
	YYYY:	d => d.getFullYear(),
	// 19
	YY:		d => (d.getFullYear()+'').slice(2),
	// July
	MMMM:	(d, names) => names.MMMM[d.getMonth()],
	// Jul
	MMM:	(d, names) => names.MMM[d.getMonth()],
	// 07
	MM:		d => zeroPad2(d.getMonth()+1),
	// 7
	M:		d => d.getMonth()+1,
	// 09
	DD:		d => zeroPad2(d.getDate()),
	// 9
	D:		d => d.getDate(),
	// Monday
	WWWW:	(d, names) => names.WWWW[d.getDay()],
	// Mon
	WWW:	(d, names) => names.WWW[d.getDay()],
	// 03
	HH:		d => zeroPad2(d.getHours()),
	// 3
	H:		d => d.getHours(),
	// 9 (12hr, unpadded)
	h:		d => {let h = d.getHours(); return h == 0 ? 12 : h > 12 ? h - 12 : h;},
	// AM
	AA:		d => d.getHours() >= 12 ? 'PM' : 'AM',
	// am
	aa:		d => d.getHours() >= 12 ? 'pm' : 'am',
	// a
	a:		d => d.getHours() >= 12 ? 'p' : 'a',
	// 09
	mm:		d => zeroPad2(d.getMinutes()),
	// 9
	m:		d => d.getMinutes(),
	// 09
	ss:		d => zeroPad2(d.getSeconds()),
	// 9
	s:		d => d.getSeconds(),
	// 374
	fff:	d => zeroPad3(d.getMilliseconds()),
};

function fmtDate(tpl, names) {
	names = names || engNames;
	let parts = [];

	let R = /\{([a-z]+)\}|[^{]+/gi, m;

	while (m = R.exec(tpl))
		parts.push(m[0][0] == '{' ? subs[m[1]] : m[0]);

	return d => {
		let out = '';

		for (let i = 0; i < parts.length; i++)
			out += typeof parts[i] == "string" ? parts[i] : parts[i](d, names);

		return out;
	}
}

const localTz = new Intl.DateTimeFormat().resolvedOptions().timeZone;

// https://stackoverflow.com/questions/15141762/how-to-initialize-a-javascript-date-to-a-particular-time-zone/53652131#53652131
function tzDate(date, tz) {
	let date2;

	// perf optimization
	if (tz == 'UTC' || tz == 'Etc/UTC')
		date2 = new Date(+date + date.getTimezoneOffset() * 6e4);
	else if (tz == localTz)
		date2 = date;
	else {
		date2 = new Date(date.toLocaleString('en-US', {timeZone: tz}));
		date2.setMilliseconds(date.getMilliseconds());
	}

	return date2;
}

const syncs = {};

function _sync(key, opts) {
	let s = syncs[key];

	if (!s) {
		s = {
			key,
			plots: [],
			sub(plot) {
				s.plots.push(plot);
			},
			unsub(plot) {
				s.plots = s.plots.filter(c => c != plot);
			},
			pub(type, self, x, y, w, h, i) {
				for (let j = 0; j < s.plots.length; j++)
					s.plots[j] != self && s.plots[j].pub(type, self, x, y, w, h, i);
			},
		};

		if (key != null)
			syncs[key] = s;
	}

	return s;
}

const BAND_CLIP_FILL   = 1 << 0;
const BAND_CLIP_STROKE = 1 << 1;

function orient(u, seriesIdx, cb) {
	const mode = u.mode;
	const series = u.series[seriesIdx];
	const data = mode == 2 ? u._data[seriesIdx] : u._data;
	const scales = u.scales;
	const bbox   = u.bbox;

	let dx = data[0],
		dy = mode == 2 ? data[1] : data[seriesIdx],
		sx = mode == 2 ? scales[series.facets[0].scale] : scales[u.series[0].scale],
		sy = mode == 2 ? scales[series.facets[1].scale] : scales[series.scale],
		l = bbox.left,
		t = bbox.top,
		w = bbox.width,
		h = bbox.height,
		H = u.valToPosH,
		V = u.valToPosV;

	return (sx.ori == 0
		? cb(
			series,
			dx,
			dy,
			sx,
			sy,
			H,
			V,
			l,
			t,
			w,
			h,
			moveToH,
			lineToH,
			rectH,
			arcH,
			bezierCurveToH,
		)
		: cb(
			series,
			dx,
			dy,
			sx,
			sy,
			V,
			H,
			t,
			l,
			h,
			w,
			moveToV,
			lineToV,
			rectV,
			arcV,
			bezierCurveToV,
		)
	);
}

function bandFillClipDirs(self, seriesIdx) {
	let fillDir = 0;

	// 2 bits, -1 | 1
	let clipDirs = 0;

	let bands = ifNull(self.bands, EMPTY_ARR);

	for (let i = 0; i < bands.length; i++) {
		let b = bands[i];

		// is a "from" band edge
		if (b.series[0] == seriesIdx)
			fillDir = b.dir;
		// is a "to" band edge
		else if (b.series[1] == seriesIdx) {
			if (b.dir == 1)
				clipDirs |= 1;
			else
				clipDirs |= 2;
		}
	}

	return [
		fillDir,
		(
			clipDirs == 1 ? -1 : // neg only
			clipDirs == 2 ?  1 : // pos only
			clipDirs == 3 ?  2 : // both
			                 0   // neither
		)
	];
}

function seriesFillTo(self, seriesIdx, dataMin, dataMax, bandFillDir) {
	let mode = self.mode;
	let series = self.series[seriesIdx];
	let scaleKey = mode == 2 ? series.facets[1].scale : series.scale;
	let scale = self.scales[scaleKey];

	return (
		bandFillDir == -1 ? scale.min :
		bandFillDir ==  1 ? scale.max :
		scale.distr ==  3 ? (
			scale.dir == 1 ? scale.min :
			scale.max
		) : 0
	);
}

// creates inverted band clip path (from stroke path -> yMax || yMin)
// clipDir is always inverse of fillDir
// default clip dir is upwards (1), since default band fill is downwards/fillBelowTo (-1) (highIdx -> lowIdx)
function clipBandLine(self, seriesIdx, idx0, idx1, strokePath, clipDir) {
	return orient(self, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
		let pxRound = series.pxRound;

		const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
		const lineTo = scaleX.ori == 0 ? lineToH : lineToV;

		let frIdx, toIdx;

		if (dir == 1) {
			frIdx = idx0;
			toIdx = idx1;
		}
		else {
			frIdx = idx1;
			toIdx = idx0;
		}

		// path start
		let x0 = pxRound(valToPosX(dataX[frIdx], scaleX, xDim, xOff));
		let y0 = pxRound(valToPosY(dataY[frIdx], scaleY, yDim, yOff));
		// path end x
		let x1 = pxRound(valToPosX(dataX[toIdx], scaleX, xDim, xOff));
		// upper or lower y limit
		let yLimit = pxRound(valToPosY(clipDir == 1 ? scaleY.max : scaleY.min, scaleY, yDim, yOff));

		let clip = new Path2D(strokePath);

		lineTo(clip, x1, yLimit);
		lineTo(clip, x0, yLimit);
		lineTo(clip, x0, y0);

		return clip;
	});
}

function clipGaps(gaps, ori, plotLft, plotTop, plotWid, plotHgt) {
	let clip = null;

	// create clip path (invert gaps and non-gaps)
	if (gaps.length > 0) {
		clip = new Path2D();

		const rect = ori == 0 ? rectH : rectV;

		let prevGapEnd = plotLft;

		for (let i = 0; i < gaps.length; i++) {
			let g = gaps[i];

			if (g[1] > g[0]) {
				let w = g[0] - prevGapEnd;

				w > 0 && rect(clip, prevGapEnd, plotTop, w, plotTop + plotHgt);

				prevGapEnd = g[1];
			}
		}

		let w = plotLft + plotWid - prevGapEnd;

		// hack to ensure we expand the clip enough to avoid cutting off strokes at edges
		let maxStrokeWidth = 10;

		w > 0 && rect(clip, prevGapEnd, plotTop - maxStrokeWidth / 2, w, plotTop + plotHgt + maxStrokeWidth);
	}

	return clip;
}

function addGap(gaps, fromX, toX) {
	let prevGap = gaps[gaps.length - 1];

	if (prevGap && prevGap[0] == fromX)			// TODO: gaps must be encoded at stroke widths?
		prevGap[1] = toX;
	else
		gaps.push([fromX, toX]);
}

function findGaps(xs, ys, idx0, idx1, dir, pixelForX, align) {
	let gaps = [];
	let len = xs.length;

	for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
		let yVal = ys[i];

		if (yVal === null) {
			let fr = i, to = i;

			if (dir == 1) {
				while (++i <= idx1 && ys[i] === null)
					to = i;
			}
			else {
				while (--i >= idx0 && ys[i] === null)
					to = i;
			}

			let frPx = pixelForX(xs[fr]);
			let toPx = to == fr ? frPx : pixelForX(xs[to]);

			// if value adjacent to edge null is same pixel, then it's partially
			// filled and gap should start at next pixel
			let fri2 = fr - dir;
			let frPx2 = align <= 0 && fri2 >= 0 && fri2 < len ? pixelForX(xs[fri2]) : frPx;
		//	if (frPx2 == frPx)
		//		frPx++;
		//	else
				frPx = frPx2;

			let toi2 = to + dir;
			let toPx2 = align >= 0 && toi2 >= 0 && toi2 < len ? pixelForX(xs[toi2]) : toPx;
		//	if (toPx2 == toPx)
		//		toPx--;
		//	else
				toPx = toPx2;

			if (toPx >= frPx)
				gaps.push([frPx, toPx]); // addGap
		}
	}

	return gaps;
}

function pxRoundGen(pxAlign) {
	return pxAlign == 0 ? retArg0 : pxAlign == 1 ? round : v => incrRound(v, pxAlign);
}

/*
// inefficient linear interpolation that does bi-directinal scans on each call
export function costlyLerp(i, idx0, idx1, _dirX, dataY) {
	let prevNonNull = nonNullIdx(dataY, _dirX == 1 ? idx0 : idx1, i, -_dirX);
	let nextNonNull = nonNullIdx(dataY, i, _dirX == 1 ? idx1 : idx0,  _dirX);

	let prevVal = dataY[prevNonNull];
	let nextVal = dataY[nextNonNull];

	return prevVal + (i - prevNonNull) / (nextNonNull - prevNonNull) * (nextVal - prevVal);
}
*/

function rect(ori) {
	let moveTo = ori == 0 ?
		moveToH :
		moveToV;

	let arcTo = ori == 0 ?
		(p, x1, y1, x2, y2, r) => { p.arcTo(x1, y1, x2, y2, r); } :
		(p, y1, x1, y2, x2, r) => { p.arcTo(x1, y1, x2, y2, r); };

	let rect = ori == 0 ?
		(p, x, y, w, h) => { p.rect(x, y, w, h); } :
		(p, y, x, h, w) => { p.rect(x, y, w, h); };

	// TODO (pending better browser support): https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect
	return (p, x, y, w, h, endRad = 0, baseRad = 0) => {
		if (endRad == 0 && baseRad == 0)
			rect(p, x, y, w, h);
		else {
			endRad  = min(endRad,  w / 2, h / 2);
			baseRad = min(baseRad, w / 2, h / 2);

			// adapted from https://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-using-html-canvas/7838871#7838871
			moveTo(p, x + endRad, y);
			arcTo(p, x + w, y, x + w, y + h, endRad);
			arcTo(p, x + w, y + h, x, y + h, baseRad);
			arcTo(p, x, y + h, x, y, baseRad);
			arcTo(p, x, y, x + w, y, endRad);
			p.closePath();
		}
	};
}

// orientation-inverting canvas functions
const moveToH = (p, x, y) => { p.moveTo(x, y); };
const moveToV = (p, y, x) => { p.moveTo(x, y); };
const lineToH = (p, x, y) => { p.lineTo(x, y); };
const lineToV = (p, y, x) => { p.lineTo(x, y); };
const rectH = rect(0);
const rectV = rect(1);
const arcH = (p, x, y, r, startAngle, endAngle) => { p.arc(x, y, r, startAngle, endAngle); };
const arcV = (p, y, x, r, startAngle, endAngle) => { p.arc(x, y, r, startAngle, endAngle); };
const bezierCurveToH = (p, bp1x, bp1y, bp2x, bp2y, p2x, p2y) => { p.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y); };
const bezierCurveToV = (p, bp1y, bp1x, bp2y, bp2x, p2y, p2x) => { p.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y); };

// TODO: drawWrap(seriesIdx, drawPoints) (save, restore, translate, clip)
function points(opts) {
	return (u, seriesIdx, idx0, idx1, filtIdxs) => {
	//	log("drawPoints()", arguments);
		let { pxRatio } = u;

		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
			let { pxRound, points } = series;

			let moveTo, arc;

			if (scaleX.ori == 0) {
				moveTo = moveToH;
				arc = arcH;
			}
			else {
				moveTo = moveToV;
				arc = arcV;
			}

			const width = roundDec(points.width * pxRatio, 3);

			let rad = (points.size - points.width) / 2 * pxRatio;
			let dia = roundDec(rad * 2, 3);

			let fill = new Path2D();
			let clip = new Path2D();

			let { left: lft, top: top, width: wid, height: hgt } = u.bbox;

			rectH(clip,
				lft - dia,
				top - dia,
				wid + dia * 2,
				hgt + dia * 2,
			);

			const drawPoint = pi => {
				if (dataY[pi] != null) {
					let x = pxRound(valToPosX(dataX[pi], scaleX, xDim, xOff));
					let y = pxRound(valToPosY(dataY[pi], scaleY, yDim, yOff));

					moveTo(fill, x + rad, y);
					arc(fill, x, y, rad, 0, PI * 2);
				}
			};

			if (filtIdxs)
				filtIdxs.forEach(drawPoint);
			else {
				for (let pi = idx0; pi <= idx1; pi++)
					drawPoint(pi);
			}

			return {
				stroke: width > 0 ? fill : null,
				fill,
				clip,
				flags: BAND_CLIP_FILL | BAND_CLIP_STROKE,
			};
		});
	};
}

function _drawAcc(lineTo) {
	return (stroke, accX, minY, maxY, inY, outY) => {
		if (minY != maxY) {
			if (inY != minY && outY != minY)
				lineTo(stroke, accX, minY);
			if (inY != maxY && outY != maxY)
				lineTo(stroke, accX, maxY);

			lineTo(stroke, accX, outY);
		}
	};
}

const drawAccH = _drawAcc(lineToH);
const drawAccV = _drawAcc(lineToV);

function linear(opts) {
	const alignGaps = ifNull(opts?.alignGaps, 0);

	return (u, seriesIdx, idx0, idx1) => {
		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
			[idx0, idx1] = nonNullIdxs(dataY, idx0, idx1);

			let pxRound = series.pxRound;

			let pixelForX = val => pxRound(valToPosX(val, scaleX, xDim, xOff));
			let pixelForY = val => pxRound(valToPosY(val, scaleY, yDim, yOff));

			let lineTo, drawAcc;

			if (scaleX.ori == 0) {
				lineTo = lineToH;
				drawAcc = drawAccH;
			}
			else {
				lineTo = lineToV;
				drawAcc = drawAccV;
			}

			const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);

			const _paths = {stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL};
			const stroke = _paths.stroke;

			let hasGap = false;

			// decimate when number of points >= 4x available pixels
			const decimate = idx1 - idx0 >= xDim * 4;

			if (decimate) {
				let xForPixel = pos => u.posToVal(pos, scaleX.key, true);

				let minY = null,
					maxY = null,
					inY, outY, drawnAtX;

				let accX = pixelForX(dataX[dir == 1 ? idx0 : idx1]);

				let idx0px = pixelForX(dataX[idx0]);
				let idx1px = pixelForX(dataX[idx1]);

				// tracks limit of current x bucket to avoid having to get x pixel for every x value
				let nextAccXVal = xForPixel(dir == 1 ? idx0px + 1 : idx1px - 1);

				for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
					let xVal = dataX[i];
					let reuseAccX = dir == 1 ? (xVal < nextAccXVal) : (xVal > nextAccXVal);
					let x = reuseAccX ? accX :  pixelForX(xVal);

					let yVal = dataY[i];

					if (x == accX) {
						if (yVal != null) {
							outY = yVal;

							if (minY == null) {
								lineTo(stroke, x, pixelForY(outY));
								inY = minY = maxY = outY;
							} else {
								if (outY < minY)
									minY = outY;
								else if (outY > maxY)
									maxY = outY;
							}
						}
						else {
							if (yVal === null)
								hasGap = true;
						}
					}
					else {
						if (minY != null)
							drawAcc(stroke, accX, pixelForY(minY), pixelForY(maxY), pixelForY(inY), pixelForY(outY));

						if (yVal != null) {
							outY = yVal;
							lineTo(stroke, x, pixelForY(outY));
							minY = maxY = inY = outY;
						}
						else {
							minY = maxY = null;

							if (yVal === null)
								hasGap = true;
						}

						accX = x;
						nextAccXVal = xForPixel(accX + dir);
					}
				}

				if (minY != null && minY != maxY && drawnAtX != accX)
					drawAcc(stroke, accX, pixelForY(minY), pixelForY(maxY), pixelForY(inY), pixelForY(outY));
			}
			else {
				for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
					let yVal = dataY[i];

					if (yVal === null)
						hasGap = true;
					else if (yVal != null)
						lineTo(stroke, pixelForX(dataX[i]), pixelForY(yVal));
				}
			}

			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

			if (series.fill != null || bandFillDir != 0) {
				let fill = _paths.fill = new Path2D(stroke);

				let fillToVal = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
				let fillToY = pixelForY(fillToVal);

				let frX = pixelForX(dataX[idx0]);
				let toX = pixelForX(dataX[idx1]);

				if (dir == -1)
					[toX, frX] = [frX, toX];

				lineTo(fill, toX, fillToY);
				lineTo(fill, frX, fillToY);
			}

			if (!series.spanGaps) { // skip in mode: 2?
			//	console.time('gaps');
				let gaps = [];

				hasGap && gaps.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));

			//	console.timeEnd('gaps');

			//	console.log('gaps', JSON.stringify(gaps));

				_paths.gaps = gaps = series.gaps(u, seriesIdx, idx0, idx1, gaps);

				_paths.clip = clipGaps(gaps, scaleX.ori, xOff, yOff, xDim, yDim);
			}

			if (bandClipDir != 0) {
				_paths.band = bandClipDir == 2 ? [
					clipBandLine(u, seriesIdx, idx0, idx1, stroke, -1),
					clipBandLine(u, seriesIdx, idx0, idx1, stroke,  1),
				] : clipBandLine(u, seriesIdx, idx0, idx1, stroke, bandClipDir);
			}

			return _paths;
		});
	};
}

// BUG: align: -1 behaves like align: 1 when scale.dir: -1
function stepped(opts) {
	const align = ifNull(opts.align, 1);
	// whether to draw ascenders/descenders at null/gap bondaries
	const ascDesc = ifNull(opts.ascDesc, false);
	const alignGaps = ifNull(opts.alignGaps, 0);
	const extend = ifNull(opts.extend, false);

	return (u, seriesIdx, idx0, idx1) => {
		let { pxRatio } = u;

		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
			[idx0, idx1] = nonNullIdxs(dataY, idx0, idx1);

			let pxRound = series.pxRound;

			let { left, width } = u.bbox;

			let pixelForX = val => pxRound(valToPosX(val, scaleX, xDim, xOff));
			let pixelForY = val => pxRound(valToPosY(val, scaleY, yDim, yOff));

			let lineTo = scaleX.ori == 0 ? lineToH : lineToV;

			const _paths = {stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL};
			const stroke = _paths.stroke;

			const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);

			let prevYPos  = pixelForY(dataY[dir == 1 ? idx0 : idx1]);
			let firstXPos = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
			let prevXPos = firstXPos;

			let firstXPosExt = firstXPos;

			if (extend && align == -1) {
				firstXPosExt = left;
				lineTo(stroke, firstXPosExt, prevYPos);
			}

			lineTo(stroke, firstXPos, prevYPos);

			for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
				let yVal1 = dataY[i];

				if (yVal1 == null)
					continue;

				let x1 = pixelForX(dataX[i]);
				let y1 = pixelForY(yVal1);

				if (align == 1)
					lineTo(stroke, x1, prevYPos);
				else
					lineTo(stroke, prevXPos, y1);

				lineTo(stroke, x1, y1);

				prevYPos = y1;
				prevXPos = x1;
			}

			let prevXPosExt = prevXPos;

			if (extend && align == 1) {
				prevXPosExt = left + width;
				lineTo(stroke, prevXPosExt, prevYPos);
			}

			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

			if (series.fill != null || bandFillDir != 0) {
				let fill = _paths.fill = new Path2D(stroke);

				let fillTo = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
				let fillToY = pixelForY(fillTo);

				lineTo(fill, prevXPosExt, fillToY);
				lineTo(fill, firstXPosExt, fillToY);
			}

			if (!series.spanGaps) {
			//	console.time('gaps');
				let gaps = [];

				gaps.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));

			//	console.timeEnd('gaps');

			//	console.log('gaps', JSON.stringify(gaps));

				// expand/contract clips for ascenders/descenders
				let halfStroke = (series.width * pxRatio) / 2;
				let startsOffset = (ascDesc || align ==  1) ?  halfStroke : -halfStroke;
				let endsOffset   = (ascDesc || align == -1) ? -halfStroke :  halfStroke;

				gaps.forEach(g => {
					g[0] += startsOffset;
					g[1] += endsOffset;
				});

				_paths.gaps = gaps = series.gaps(u, seriesIdx, idx0, idx1, gaps);

				_paths.clip = clipGaps(gaps, scaleX.ori, xOff, yOff, xDim, yDim);
			}

			if (bandClipDir != 0) {
				_paths.band = bandClipDir == 2 ? [
					clipBandLine(u, seriesIdx, idx0, idx1, stroke, -1),
					clipBandLine(u, seriesIdx, idx0, idx1, stroke,  1),
				] : clipBandLine(u, seriesIdx, idx0, idx1, stroke, bandClipDir);
			}

			return _paths;
		});
	};
}

function findColWidth(dataX, dataY, valToPosX, scaleX, xDim, xOff, colWid = inf) {
	if (dataX.length > 1) {
		// prior index with non-undefined y data
		let prevIdx = null;

		// scan full dataset for smallest adjacent delta
		// will not work properly for non-linear x scales, since does not do expensive valToPosX calcs till end
		for (let i = 0, minDelta = Infinity; i < dataX.length; i++) {
			if (dataY[i] !== undefined) {
				if (prevIdx != null) {
					let delta = abs(dataX[i] - dataX[prevIdx]);

					if (delta < minDelta) {
						minDelta = delta;
						colWid = abs(valToPosX(dataX[i], scaleX, xDim, xOff) - valToPosX(dataX[prevIdx], scaleX, xDim, xOff));
					}
				}

				prevIdx = i;
			}
		}
	}

	return colWid;
}

function bars(opts) {
	opts = opts || EMPTY_OBJ;
	const size = ifNull(opts.size, [0.6, inf, 1]);
	const align = opts.align || 0;
	const _extraGap = (opts.gap || 0);

	let ro = opts.radius;

	ro =
		// [valueRadius, baselineRadius]
		ro == null ? [0, 0] :
		typeof ro == 'number' ? [ro, 0] : ro;

	const radiusFn = fnOrSelf(ro);

	const gapFactor = 1 - size[0];
	const _maxWidth  = ifNull(size[1], inf);
	const _minWidth  = ifNull(size[2], 1);

	const disp = ifNull(opts.disp, EMPTY_OBJ);
	const _each = ifNull(opts.each, _ => {});

	const { fill: dispFills, stroke: dispStrokes } = disp;

	return (u, seriesIdx, idx0, idx1) => {
		let { pxRatio } = u;

		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
			let pxRound = series.pxRound;
			let _align = align;

			let extraGap = _extraGap * pxRatio;
			let maxWidth = _maxWidth * pxRatio;
			let minWidth = _minWidth * pxRatio;

			let valRadius, baseRadius;

			if (scaleX.ori == 0)
				[valRadius, baseRadius] = radiusFn(u, seriesIdx);
			else
				[baseRadius, valRadius] = radiusFn(u, seriesIdx);

			const _dirX = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
		//	const _dirY = scaleY.dir * (scaleY.ori == 1 ? 1 : -1);

			let rect = scaleX.ori == 0 ? rectH : rectV;

			let each = scaleX.ori == 0 ? _each : (u, seriesIdx, i, top, lft, hgt, wid) => {
				_each(u, seriesIdx, i, lft, top, wid, hgt);
			};

			// band where this series is the "from" edge
			let band = ifNull(u.bands, EMPTY_ARR).find(b => b.series[0] == seriesIdx);

			let fillDir = band != null ? band.dir : 0;
			let fillTo = series.fillTo(u, seriesIdx, series.min, series.max, fillDir);
			let fillToY = pxRound(valToPosY(fillTo, scaleY, yDim, yOff));

			// barWid is to center of stroke
			let xShift, barWid, fullGap, colWid = xDim;

			let strokeWidth = pxRound(series.width * pxRatio);

			let multiPath = false;

			let fillColors = null;
			let fillPaths = null;
			let strokeColors = null;
			let strokePaths = null;

			if (dispFills != null && (strokeWidth == 0 || dispStrokes != null)) {
				multiPath = true;

				fillColors = dispFills.values(u, seriesIdx, idx0, idx1);
				fillPaths = new Map();
				(new Set(fillColors)).forEach(color => {
					if (color != null)
						fillPaths.set(color, new Path2D());
				});

				if (strokeWidth > 0) {
					strokeColors = dispStrokes.values(u, seriesIdx, idx0, idx1);
					strokePaths = new Map();
					(new Set(strokeColors)).forEach(color => {
						if (color != null)
							strokePaths.set(color, new Path2D());
					});
				}
			}

			let { x0, size } = disp;

			if (x0 != null && size != null) {
				_align = 1;
				dataX = x0.values(u, seriesIdx, idx0, idx1);

				if (x0.unit == 2)
					dataX = dataX.map(pct => u.posToVal(xOff + pct * xDim, scaleX.key, true));

				// assumes uniform sizes, for now
				let sizes = size.values(u, seriesIdx, idx0, idx1);

				if (size.unit == 2)
					barWid = sizes[0] * xDim;
				else
					barWid = valToPosX(sizes[0], scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff); // assumes linear scale (delta from 0)

				colWid = findColWidth(dataX, dataY, valToPosX, scaleX, xDim, xOff, colWid);

				let gapWid = colWid - barWid;
				fullGap = gapWid + extraGap;
			}
			else {
				colWid = findColWidth(dataX, dataY, valToPosX, scaleX, xDim, xOff, colWid);

				let gapWid = colWid * gapFactor;

				fullGap = gapWid + extraGap;
				barWid = colWid - fullGap;
			}

			if (fullGap < 1)
				fullGap = 0;

			if (strokeWidth >= barWid / 2)
				strokeWidth = 0;

			// for small gaps, disable pixel snapping since gap inconsistencies become noticible and annoying
			if (fullGap < 5)
				pxRound = retArg0;

			let insetStroke = fullGap > 0;

			let rawBarWid = colWid - fullGap - (insetStroke ? strokeWidth : 0);

			barWid = pxRound(clamp(rawBarWid, minWidth, maxWidth));

			xShift = (_align == 0 ? barWid / 2 : _align == _dirX ? 0 : barWid) - _align * _dirX * ((_align == 0 ? extraGap / 2 : 0) + (insetStroke ? strokeWidth / 2 : 0));


			const _paths = {stroke: null, fill: null, clip: null, band: null, gaps: null, flags: 0};  // disp, geom

			const stroke = multiPath ? null : new Path2D();

			let dataY0 = null;

			if (band != null)
				dataY0 = u.data[band.series[1]];
			else {
				let { y0, y1 } = disp;

				if (y0 != null && y1 != null) {
					dataY = y1.values(u, seriesIdx, idx0, idx1);
					dataY0 = y0.values(u, seriesIdx, idx0, idx1);
				}
			}

			let radVal = valRadius * barWid;
			let radBase = baseRadius * barWid;

			for (let i = _dirX == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += _dirX) {
				let yVal = dataY[i];

				if (yVal == null)
					continue;

				if (dataY0 != null) {
					let yVal0 = dataY0[i] ?? 0;

					if (yVal - yVal0 == 0)
						continue;

					fillToY = valToPosY(yVal0, scaleY, yDim, yOff);
				}

				let xVal = scaleX.distr != 2 || disp != null ? dataX[i] : i;

				// TODO: all xPos can be pre-computed once for all series in aligned set
				let xPos = valToPosX(xVal, scaleX, xDim, xOff);
				let yPos = valToPosY(ifNull(yVal, fillTo), scaleY, yDim, yOff);

				let lft = pxRound(xPos - xShift);
				let btm = pxRound(max(yPos, fillToY));
				let top = pxRound(min(yPos, fillToY));
				// this includes the stroke
				let barHgt = btm - top;

				if (yVal != null) {  // && yVal != fillTo (0 height bar)
					let rv = yVal < 0 ? radBase : radVal;
					let rb = yVal < 0 ? radVal : radBase;

					if (multiPath) {
						if (strokeWidth > 0 && strokeColors[i] != null)
							rect(strokePaths.get(strokeColors[i]), lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);

						if (fillColors[i] != null)
							rect(fillPaths.get(fillColors[i]), lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);
					}
					else
						rect(stroke, lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);

					each(u, seriesIdx, i,
						lft    - strokeWidth / 2,
						top,
						barWid + strokeWidth,
						barHgt,
					);
				}
			}

			if (strokeWidth > 0)
				_paths.stroke = multiPath ? strokePaths : stroke;
			else if (!multiPath) {
				_paths._fill = series.width == 0 ? series._fill : series._stroke ?? series._fill;
				_paths.width = 0;
			}

			_paths.fill = multiPath ? fillPaths : stroke;

			return _paths;
		});
	};
}

function splineInterp(interp, opts) {
	const alignGaps = ifNull(opts?.alignGaps, 0);

	return (u, seriesIdx, idx0, idx1) => {
		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
			[idx0, idx1] = nonNullIdxs(dataY, idx0, idx1);

			let pxRound = series.pxRound;

			let pixelForX = val => pxRound(valToPosX(val, scaleX, xDim, xOff));
			let pixelForY = val => pxRound(valToPosY(val, scaleY, yDim, yOff));

			let moveTo, bezierCurveTo, lineTo;

			if (scaleX.ori == 0) {
				moveTo = moveToH;
				lineTo = lineToH;
				bezierCurveTo = bezierCurveToH;
			}
			else {
				moveTo = moveToV;
				lineTo = lineToV;
				bezierCurveTo = bezierCurveToV;
			}

			const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);

			let firstXPos = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
			let prevXPos = firstXPos;

			let xCoords = [];
			let yCoords = [];

			for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
				let yVal = dataY[i];

				if (yVal != null) {
					let xVal = dataX[i];
					let xPos = pixelForX(xVal);

					xCoords.push(prevXPos = xPos);
					yCoords.push(pixelForY(dataY[i]));
				}
			}

			const _paths = {stroke: interp(xCoords, yCoords, moveTo, lineTo, bezierCurveTo, pxRound), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL};
			const stroke = _paths.stroke;

			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

			if (series.fill != null || bandFillDir != 0) {
				let fill = _paths.fill = new Path2D(stroke);

				let fillTo = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
				let fillToY = pixelForY(fillTo);

				lineTo(fill, prevXPos, fillToY);
				lineTo(fill, firstXPos, fillToY);
			}

			if (!series.spanGaps) {
			//	console.time('gaps');
				let gaps = [];

				gaps.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));

			//	console.timeEnd('gaps');

			//	console.log('gaps', JSON.stringify(gaps));

				_paths.gaps = gaps = series.gaps(u, seriesIdx, idx0, idx1, gaps);

				_paths.clip = clipGaps(gaps, scaleX.ori, xOff, yOff, xDim, yDim);
			}

			if (bandClipDir != 0) {
				_paths.band = bandClipDir == 2 ? [
					clipBandLine(u, seriesIdx, idx0, idx1, stroke, -1),
					clipBandLine(u, seriesIdx, idx0, idx1, stroke,  1),
				] : clipBandLine(u, seriesIdx, idx0, idx1, stroke, bandClipDir);
			}

			return _paths;

			//  if FEAT_PATHS: false in rollup.config.js
			//	u.ctx.save();
			//	u.ctx.beginPath();
			//	u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
			//	u.ctx.clip();
			//	u.ctx.strokeStyle = u.series[sidx].stroke;
			//	u.ctx.stroke(stroke);
			//	u.ctx.fillStyle = u.series[sidx].fill;
			//	u.ctx.fill(fill);
			//	u.ctx.restore();
			//	return null;
		});
	};
}

function monotoneCubic(opts) {
	return splineInterp(_monotoneCubic, opts);
}

// Monotone Cubic Spline interpolation, adapted from the Chartist.js implementation:
// https://github.com/gionkunz/chartist-js/blob/e7e78201bffe9609915e5e53cfafa29a5d6c49f9/src/scripts/interpolation.js#L240-L369
function _monotoneCubic(xs, ys, moveTo, lineTo, bezierCurveTo, pxRound) {
	const n = xs.length;

	if (n < 2)
		return null;

	const path = new Path2D();

	moveTo(path, xs[0], ys[0]);

	if (n == 2)
		lineTo(path, xs[1], ys[1]);
	else {
		let ms  = Array(n),
			ds  = Array(n - 1),
			dys = Array(n - 1),
			dxs = Array(n - 1);

		// calc deltas and derivative
		for (let i = 0; i < n - 1; i++) {
			dys[i] = ys[i + 1] - ys[i];
			dxs[i] = xs[i + 1] - xs[i];
			ds[i]  = dys[i] / dxs[i];
		}

		// determine desired slope (m) at each point using Fritsch-Carlson method
		// http://math.stackexchange.com/questions/45218/implementation-of-monotone-cubic-interpolation
		ms[0] = ds[0];

		for (let i = 1; i < n - 1; i++) {
			if (ds[i] === 0 || ds[i - 1] === 0 || (ds[i - 1] > 0) !== (ds[i] > 0))
				ms[i] = 0;
			else {
				ms[i] = 3 * (dxs[i - 1] + dxs[i]) / (
					(2 * dxs[i] + dxs[i - 1]) / ds[i - 1] +
					(dxs[i] + 2 * dxs[i - 1]) / ds[i]
				);

				if (!isFinite(ms[i]))
					ms[i] = 0;
			}
		}

		ms[n - 1] = ds[n - 2];

		for (let i = 0; i < n - 1; i++) {
			bezierCurveTo(
				path,
				xs[i] + dxs[i] / 3,
				ys[i] + ms[i] * dxs[i] / 3,
				xs[i + 1] - dxs[i] / 3,
				ys[i + 1] - ms[i + 1] * dxs[i] / 3,
				xs[i + 1],
				ys[i + 1],
			);
		}
	}

	return path;
}

/**
 * Standardized error handling system for uPlot modules
 */

/**
 * Base uPlot error class with module context
 */
class UPlotError extends Error {
	constructor(message, module, context = null, originalError = null) {
		const fullMessage = `[${module}] ${message}`;
		super(fullMessage);
		
		this.name = 'UPlotError';
		this.module = module;
		this.context = context;
		this.originalError = originalError;
		
		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UPlotError);
		}
	}
}

/**
 * Error types for different categories of errors
 */
const ERROR_TYPES = {
	INITIALIZATION: 'INITIALIZATION',
	VALIDATION: 'VALIDATION',
	RENDERING: 'RENDERING',
	DATA_PROCESSING: 'DATA_PROCESSING',
	EVENT_HANDLING: 'EVENT_HANDLING',
	SCALE_CALCULATION: 'SCALE_CALCULATION',
	LAYOUT_CALCULATION: 'LAYOUT_CALCULATION'
};

/**
 * Error boundary wrapper for module methods
 */
function withErrorBoundary(moduleName, methodName, fn) {
	return function(...args) {
		try {
			return fn.apply(this, args);
		} catch (error) {
			const context = {
				method: methodName,
				args: args.length > 0 ? 'provided' : 'none',
				timestamp: Date.now()
			};
			
			if (error instanceof UPlotError) {
				// Re-throw uPlot errors with additional context
				error.context = { ...error.context, ...context };
				throw error;
			} else {
				// Wrap native errors
				throw new UPlotError(
					`Error in ${methodName}: ${error.message}`,
					moduleName,
					context,
					error
				);
			}
		}
	};
}

/**
 * Validation helper that throws standardized errors
 */
function validateRequired(value, paramName, moduleName, methodName = 'unknown') {
	if (value === null || value === undefined) {
		throw new UPlotError(
			`Required parameter '${paramName}' is missing or null`,
			moduleName,
			{ method: methodName, parameter: paramName, type: ERROR_TYPES.VALIDATION }
		);
	}
	return value;
}

/**
 * Type validation helper
 */
function validateType(value, expectedType, paramName, moduleName, methodName = 'unknown') {
	const actualType = typeof value;
	if (actualType !== expectedType) {
		throw new UPlotError(
			`Parameter '${paramName}' expected ${expectedType} but got ${actualType}`,
			moduleName,
			{ 
				method: methodName, 
				parameter: paramName, 
				expectedType, 
				actualType,
				type: ERROR_TYPES.VALIDATION 
			}
		);
	}
	return value;
}

/**
 * Safe execution wrapper that catches and logs errors without throwing
 */
function safeExecute(moduleName, methodName, fn, fallbackValue = null) {
	try {
		return fn();
	} catch (error) {
		console.warn(`[${moduleName}] Non-critical error in ${methodName}:`, error);
		return fallbackValue;
	}
}

/**
 * Error reporter for debugging and monitoring
 */
class ErrorReporter {
	constructor() {
		this.errors = [];
		this.maxErrors = 100; // Prevent memory leaks
	}
	
	report(error) {
		// Add to error log
		this.errors.push({
			error,
			timestamp: Date.now(),
			stack: error.stack
		});
		
		// Maintain max size
		if (this.errors.length > this.maxErrors) {
			this.errors.shift();
		}
		
		// Log to console in development
		if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
			console.error('uPlot Error:', error);
		}
	}
	
	getErrors(moduleName = null) {
		if (!moduleName) {
			return this.errors;
		}
		return this.errors.filter(entry => entry.error.module === moduleName);
	}
	
	clear() {
		this.errors = [];
	}
}

// Global error reporter instance
const errorReporter = new ErrorReporter();

// Constants from opts.js to avoid complex dependency chain
const AXIS_SIZE_DEFAULT = 50;

/**
 * Layout Manager - handles size calculations, plot area management, and responsive layout
 */
class LayoutManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'LayoutManager', 'constructor');
			
			this.uplot = uplot;
			
			// Layout dimensions in CSS pixels
			this.fullWidCss = 0;
			this.fullHgtCss = 0;
			this.plotWidCss = 0;
			this.plotHgtCss = 0;
			this.plotLftCss = 0;
			this.plotTopCss = 0;
			
			// Layout dimensions in canvas pixels
			this.plotLft = 0;
			this.plotTop = 0;
			this.plotWid = 0;
			this.plotHgt = 0;
			
			// Previous values for diffing
			this._plotLftCss = 0;
			this._plotTopCss = 0;
			this._plotWidCss = 0;
			this._plotHgtCss = 0;
			
			// Sides with axes tracking
			this.sidesWithAxes = [false, false, false, false];
			
			// Initialize padding
			this.initPadding();
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize padding configuration
	 */
	initPadding() {
		const opts = this.uplot.opts || {};
		this.padding = (opts.padding || [this.autoPadSide, this.autoPadSide, this.autoPadSide, this.autoPadSide])
			.map(p => fnOrSelf(ifNull(p, this.autoPadSide)));
		this._padding = this.padding.map((p, i) => p(this.uplot, i, this.sidesWithAxes, 0));
	}

	/**
	 * Calculate automatic padding for a side based on axis presence
	 */
	autoPadSide = (self, side, sidesWithAxes, cycleNum) => {
		let [hasTopAxis, hasRgtAxis, hasBtmAxis, hasLftAxis] = sidesWithAxes;

		let ori = side % 2;
		let size = 0;

		if (ori == 0 && (hasLftAxis || hasRgtAxis))
			size = (side == 0 && !hasTopAxis || side == 2 && !hasBtmAxis ? round(AXIS_SIZE_DEFAULT / 3) : 0);
		if (ori == 1 && (hasTopAxis || hasBtmAxis))
			size = (side == 1 && !hasRgtAxis || side == 3 && !hasLftAxis ? round(AXIS_SIZE_DEFAULT / 2) : 0);

		return size;
	}

	/**
	 * Main size calculation function
	 */
	calcSize(width, height) {
		return withErrorBoundary('LayoutManager', 'calcSize', function(width, height) {
			validateRequired(width, 'width', 'LayoutManager', 'calcSize');
			validateRequired(height, 'height', 'LayoutManager', 'calcSize');
			validateType(width, 'number', 'width', 'LayoutManager', 'calcSize');
			validateType(height, 'number', 'height', 'LayoutManager', 'calcSize');
			
			if (width <= 0 || height <= 0) {
				throw new UPlotError(
					`Invalid dimensions: width=${width}, height=${height}. Both must be positive numbers.`,
					'LayoutManager',
					{ method: 'calcSize', width, height, type: ERROR_TYPES.VALIDATION }
				);
			}

			// Initialize dimensions
			this.fullWidCss = this.plotWidCss = width;
			this.fullHgtCss = this.plotHgtCss = height;
			this.plotLftCss = this.plotTopCss = 0;

			// Calculate plot area and axis positions
			this.calcPlotRect();
			this.calcAxesRects();

			// Convert to canvas pixels
			const pxRatio = this.uplot.pxRatio || 1;
			const bbox = this.uplot.bbox || {};
			
			this.plotLft = bbox.left = incrRound(this.plotLftCss * pxRatio, 0.5);
			this.plotTop = bbox.top = incrRound(this.plotTopCss * pxRatio, 0.5);
			this.plotWid = bbox.width = incrRound(this.plotWidCss * pxRatio, 0.5);
			this.plotHgt = bbox.height = incrRound(this.plotHgtCss * pxRatio, 0.5);

			// Update uPlot instance dimensions
			this.uplot._width = width;
			this.uplot._height = height;
			
			return {
				fullWidCss: this.fullWidCss,
				fullHgtCss: this.fullHgtCss,
				plotWidCss: this.plotWidCss,
				plotHgtCss: this.plotHgtCss,
				plotLftCss: this.plotLftCss,
				plotTopCss: this.plotTopCss,
				plotLft: this.plotLft,
				plotTop: this.plotTop,
				plotWid: this.plotWid,
				plotHgt: this.plotHgt
			};
		}).call(this, width, height);
	}

	/**
	 * Calculate plot rectangle by accounting for axes and padding
	 */
	calcPlotRect() {
		return withErrorBoundary('LayoutManager', 'calcPlotRect', function() {
			const axes = this.uplot.axes?.axes || [];
			
			// Reset axis presence tracking
			let hasTopAxis = false;
			let hasBtmAxis = false;
			let hasRgtAxis = false;
			let hasLftAxis = false;

		// Process each axis to determine space requirements
		axes.forEach((axis, i) => {
			if (axis.show && axis._show) {
				let { side, _size } = axis;
				let isVt = side % 2;
				let labelSize = axis.label != null ? axis.labelSize : 0;

				let fullSize = _size + labelSize;

				if (fullSize > 0) {
					if (isVt) {
						this.plotWidCss -= fullSize;

						if (side == 3) {
							this.plotLftCss += fullSize;
							hasLftAxis = true;
						}
						else {
							hasRgtAxis = true;
						}
					}
					else {
						this.plotHgtCss -= fullSize;

						if (side == 0) {
							this.plotTopCss += fullSize;
							hasTopAxis = true;
						}
						else {
							hasBtmAxis = true;
						}
					}
				}
			}
		});

		// Update sides with axes tracking
		this.sidesWithAxes[0] = hasTopAxis;
		this.sidesWithAxes[1] = hasRgtAxis;
		this.sidesWithAxes[2] = hasBtmAxis;
		this.sidesWithAxes[3] = hasLftAxis;

		// Apply horizontal padding
		this.plotWidCss -= this._padding[1] + this._padding[3];
		this.plotLftCss += this._padding[3];

			// Apply vertical padding
			this.plotHgtCss -= this._padding[2] + this._padding[0];
			this.plotTopCss += this._padding[0];
		}).call(this);
	}

	/**
	 * Calculate axis rectangles and positions
	 */
	calcAxesRects() {
		const axes = this.uplot.axes?.axes || [];
		
		// Offset accumulators
		let off1 = this.plotLftCss + this.plotWidCss; // right side accumulator
		let off2 = this.plotTopCss + this.plotHgtCss; // bottom side accumulator
		let off3 = this.plotLftCss; // left side accumulator
		let off0 = this.plotTopCss; // top side accumulator

		/**
		 * Increment offset for a given side
		 */
		function incrOffset(side, size) {
			switch (side) {
				case 1: off1 += size; return off1 - size; // right
				case 2: off2 += size; return off2 - size; // bottom
				case 3: off3 -= size; return off3 + size; // left
				case 0: off0 -= size; return off0 + size; // top
			}
		}

		// Calculate positions for each axis
		axes.forEach((axis, i) => {
			if (axis.show && axis._show) {
				let side = axis.side;

				axis._pos = incrOffset(side, axis._size);

				if (axis.label != null) {
					axis._lpos = incrOffset(side, axis.labelSize);
				}
			}
		});
	}

	/**
	 * Update padding calculations (used during size convergence)
	 */
	paddingCalc(cycleNum) {
		let converged = true;

		this.padding.forEach((p, i) => {
			let _p = p(this.uplot, i, this.sidesWithAxes, cycleNum);

			if (_p != this._padding[i]) {
				converged = false;
			}

			this._padding[i] = _p;
		});

		return converged;
	}

	/**
	 * Size convergence logic to handle interdependent calculations
	 */
	convergeSize(width, height) {
		const CYCLE_LIMIT = 3;
		let converged = false;
		let cycleNum = 0;

		while (!converged) {
			cycleNum++;
			let paddingConverged = this.paddingCalc(cycleNum);

			converged = cycleNum == CYCLE_LIMIT || (paddingConverged);

			if (!converged) {
				this.calcSize(width, height);
			}
		}

		return converged;
	}

	/**
	 * Update layout with new dimensions
	 */
	updateLayout() {
		// Store previous values for comparison
		this._plotLftCss = this.plotLftCss;
		this._plotTopCss = this.plotTopCss;
		this._plotWidCss = this.plotWidCss;
		this._plotHgtCss = this.plotHgtCss;
	}

	/**
	 * Get current plot rectangle
	 */
	getPlotRect() {
		return {
			left: this.plotLftCss,
			top: this.plotTopCss,
			width: this.plotWidCss,
			height: this.plotHgtCss
		};
	}

	/**
	 * Get current padding values
	 */
	getPadding() {
		return [...this._padding];
	}

	/**
	 * Get plot dimensions in canvas pixels
	 */
	getCanvasRect() {
		return {
			left: this.plotLft,
			top: this.plotTop,
			width: this.plotWid,
			height: this.plotHgt
		};
	}

	/**
	 * Check if layout dimensions have changed
	 */
	hasChanged() {
		return (
			this._plotLftCss !== this.plotLftCss ||
			this._plotTopCss !== this.plotTopCss ||
			this._plotWidCss !== this.plotWidCss ||
			this._plotHgtCss !== this.plotHgtCss
		);
	}
}

//export const series = [];

// default formatters:

const onlyWhole = v => v % 1 == 0;

const allMults = [1,2,2.5,5];

// ...0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5
const decIncrs = genIncrs(10, -32, 0, allMults);

// 1, 2, 2.5, 5, 10, 20, 25, 50...
const oneIncrs = genIncrs(10, 0, 32, allMults);

// 1, 2,      5, 10, 20, 25, 50...
const wholeIncrs = oneIncrs.filter(onlyWhole);

const numIncrs = decIncrs.concat(oneIncrs);

const NL = "\n";

const yyyy    = "{YYYY}";
const NLyyyy  = NL + yyyy;
const md      = "{M}/{D}";
const NLmd    = NL + md;
const NLmdyy  = NLmd + "/{YY}";

const aa      = "{aa}";
const hmm     = "{h}:{mm}";
const hmmaa   = hmm + aa;
const NLhmmaa = NL + hmmaa;
const ss      = ":{ss}";

const _ = null;

function genTimeStuffs(ms) {
	let	s  = ms * 1e3,
		m  = s  * 60,
		h  = m  * 60,
		d  = h  * 24,
		mo = d  * 30,
		y  = d  * 365;

	// min of 1e-3 prevents setting a temporal x ticks too small since Date objects cannot advance ticks smaller than 1ms
	let subSecIncrs = ms == 1 ? genIncrs(10, 0, 3, allMults).filter(onlyWhole) : genIncrs(10, -3, 0, allMults);

	let timeIncrs = subSecIncrs.concat([
		// minute divisors (# of secs)
		s,
		s * 5,
		s * 10,
		s * 15,
		s * 30,
		// hour divisors (# of mins)
		m,
		m * 5,
		m * 10,
		m * 15,
		m * 30,
		// day divisors (# of hrs)
		h,
		h * 2,
		h * 3,
		h * 4,
		h * 6,
		h * 8,
		h * 12,
		// month divisors TODO: need more?
		d,
		d * 2,
		d * 3,
		d * 4,
		d * 5,
		d * 6,
		d * 7,
		d * 8,
		d * 9,
		d * 10,
		d * 15,
		// year divisors (# months, approx)
		mo,
		mo * 2,
		mo * 3,
		mo * 4,
		mo * 6,
		// century divisors
		y,
		y * 2,
		y * 5,
		y * 10,
		y * 25,
		y * 50,
		y * 100,
	]);

	// [0]:   minimum num secs in the tick incr
	// [1]:   default tick format
	// [2-7]: rollover tick formats
	// [8]:   mode: 0: replace [1] -> [2-7], 1: concat [1] + [2-7]
	const _timeAxisStamps = [
	//   tick incr    default          year                    month   day                   hour    min       sec   mode
		[y,           yyyy,            _,                      _,      _,                    _,      _,        _,       1],
		[d * 28,      "{MMM}",         NLyyyy,                 _,      _,                    _,      _,        _,       1],
		[d,           md,              NLyyyy,                 _,      _,                    _,      _,        _,       1],
		[h,           "{h}" + aa,      NLmdyy,                 _,      NLmd,                 _,      _,        _,       1],
		[m,           hmmaa,           NLmdyy,                 _,      NLmd,                 _,      _,        _,       1],
		[s,           ss,              NLmdyy + " " + hmmaa,   _,      NLmd + " " + hmmaa,   _,      NLhmmaa,  _,       1],
		[ms,          ss + ".{fff}",   NLmdyy + " " + hmmaa,   _,      NLmd + " " + hmmaa,   _,      NLhmmaa,  _,       1],
	];

	// the ensures that axis ticks, values & grid are aligned to logical temporal breakpoints and not an arbitrary timestamp
	// https://www.timeanddate.com/time/dst/
	// https://www.timeanddate.com/time/dst/2019.html
	// https://www.epochconverter.com/timezones
	function timeAxisSplits(tzDate) {
		return (self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) => {
			let splits = [];
			let isYr = foundIncr >= y;
			let isMo = foundIncr >= mo && foundIncr < y;

			// get the timezone-adjusted date
			let minDate = tzDate(scaleMin);
			let minDateTs = roundDec(minDate * ms, 3);

			// get ts of 12am (this lands us at or before the original scaleMin)
			let minMin = mkDate(minDate.getFullYear(), isYr ? 0 : minDate.getMonth(), isMo || isYr ? 1 : minDate.getDate());
			let minMinTs = roundDec(minMin * ms, 3);

			if (isMo || isYr) {
				let moIncr = isMo ? foundIncr / mo : 0;
				let yrIncr = isYr ? foundIncr / y  : 0;
			//	let tzOffset = scaleMin - minDateTs;		// needed?
				let split = minDateTs == minMinTs ? minDateTs : roundDec(mkDate(minMin.getFullYear() + yrIncr, minMin.getMonth() + moIncr, 1) * ms, 3);
				let splitDate = new Date(round(split / ms));
				let baseYear = splitDate.getFullYear();
				let baseMonth = splitDate.getMonth();

				for (let i = 0; split <= scaleMax; i++) {
					let next = mkDate(baseYear + yrIncr * i, baseMonth + moIncr * i, 1);
					let offs = next - tzDate(roundDec(next * ms, 3));

					split = roundDec((+next + offs) * ms, 3);

					if (split <= scaleMax)
						splits.push(split);
				}
			}
			else {
				let incr0 = foundIncr >= d ? d : foundIncr;
				let tzOffset = floor(scaleMin) - floor(minDateTs);
				let split = minMinTs + tzOffset + incrRoundUp(minDateTs - minMinTs, incr0);
				splits.push(split);

				let date0 = tzDate(split);

				let prevHour = date0.getHours() + (date0.getMinutes() / m) + (date0.getSeconds() / h);
				let incrHours = foundIncr / h;

				let minSpace = self.axes[axisIdx]._space;
				let pctSpace = foundSpace / minSpace;

				while (1) {
					split = roundDec(split + foundIncr, ms == 1 ? 0 : 3);

					if (split > scaleMax)
						break;

					if (incrHours > 1) {
						let expectedHour = floor(roundDec(prevHour + incrHours, 6)) % 24;
						let splitDate = tzDate(split);
						let actualHour = splitDate.getHours();

						let dstShift = actualHour - expectedHour;

						if (dstShift > 1)
							dstShift = -1;

						split -= dstShift * h;

						prevHour = (prevHour + incrHours) % 24;

						// add a tick only if it's further than 70% of the min allowed label spacing
						let prevSplit = splits[splits.length - 1];
						let pctIncr = roundDec((split - prevSplit) / foundIncr, 3);

						if (pctIncr * pctSpace >= .7)
							splits.push(split);
					}
					else
						splits.push(split);
				}
			}

			return splits;
		}
	}

	return [
		timeIncrs,
		_timeAxisStamps,
		timeAxisSplits,
	];
}

const [ timeIncrsMs, _timeAxisStampsMs, timeAxisSplitsMs ] = genTimeStuffs(1);
const [ timeIncrsS,  _timeAxisStampsS,  timeAxisSplitsS  ] = genTimeStuffs(1e-3);

// base 2
genIncrs(2, -53, 53, [1]);

/*
console.log({
	decIncrs,
	oneIncrs,
	wholeIncrs,
	numIncrs,
	timeIncrs,
	fixedDec,
});
*/

function timeAxisStamps(stampCfg, fmtDate) {
	return stampCfg.map(s => s.map((v, i) =>
		i == 0 || i == 8 || v == null ? v : fmtDate(i == 1 || s[8] == 0 ? v : s[1] + v)
	));
}

// TODO: will need to accept spaces[] and pull incr into the loop when grid will be non-uniform, eg for log scales.
// currently we ignore this for months since they're *nearly* uniform and the added complexity is not worth it
function timeAxisVals(tzDate, stamps) {
	return (self, splits, axisIdx, foundSpace, foundIncr) => {
		let s = stamps.find(s => foundIncr >= s[0]) || stamps[stamps.length - 1];

		// these track boundaries when a full label is needed again
		let prevYear;
		let prevMnth;
		let prevDate;
		let prevHour;
		let prevMins;
		let prevSecs;

		return splits.map(split => {
			let date = tzDate(split);

			let newYear = date.getFullYear();
			let newMnth = date.getMonth();
			let newDate = date.getDate();
			let newHour = date.getHours();
			let newMins = date.getMinutes();
			let newSecs = date.getSeconds();

			let stamp = (
				newYear != prevYear && s[2] ||
				newMnth != prevMnth && s[3] ||
				newDate != prevDate && s[4] ||
				newHour != prevHour && s[5] ||
				newMins != prevMins && s[6] ||
				newSecs != prevSecs && s[7] ||
				                       s[1]
			);

			prevYear = newYear;
			prevMnth = newMnth;
			prevDate = newDate;
			prevHour = newHour;
			prevMins = newMins;
			prevSecs = newSecs;

			return stamp(date);
		});
	}
}

// for when axis.values is defined as a static fmtDate template string
function timeAxisVal(tzDate, dateTpl) {
	let stamp = fmtDate(dateTpl);
	return (self, splits, axisIdx, foundSpace, foundIncr) => splits.map(split => stamp(tzDate(split)));
}

function mkDate(y, m, d) {
	return new Date(y, m, d);
}

function timeSeriesStamp(stampCfg, fmtDate) {
	return fmtDate(stampCfg);
}
function timeSeriesVal(tzDate, stamp) {
	return (self, val, seriesIdx, dataIdx) => dataIdx == null ? LEGEND_DISP : stamp(tzDate(val));
}

function legendStroke(self, seriesIdx) {
	let s = self.series[seriesIdx];
	return s.width ? s.stroke(self, seriesIdx) : s.points.width ? s.points.stroke(self, seriesIdx) : null;
}

function legendFill(self, seriesIdx) {
	return self.series[seriesIdx].fill(self, seriesIdx);
}

const legendOpts = {
	show: true,
	live: true,
	isolate: false,
	mount: noop,
	markers: {
		show: true,
		width: 2,
		stroke: legendStroke,
		fill: legendFill,
		dash: "solid",
	},
	idx: null,
	idxs: null,
	values: [],
};

function cursorPointShow(self, si) {
	let o = self.cursor.points;

	let pt = placeDiv();

	let size = o.size(self, si);
	setStylePx(pt, WIDTH, size);
	setStylePx(pt, HEIGHT, size);

	let mar = size / -2;
	setStylePx(pt, "marginLeft", mar);
	setStylePx(pt, "marginTop", mar);

	let width = o.width(self, si, size);
	width && setStylePx(pt, "borderWidth", width);

	return pt;
}

function cursorPointFill(self, si) {
	let sp = self.series[si].points;
	return sp._fill || sp._stroke;
}

function cursorPointStroke(self, si) {
	let sp = self.series[si].points;
	return sp._stroke || sp._fill;
}

function cursorPointSize(self, si) {
	let sp = self.series[si].points;
	return sp.size;
}

const moveTuple = [0,0];

function cursorMove(self, mouseLeft1, mouseTop1) {
	moveTuple[0] = mouseLeft1;
	moveTuple[1] = mouseTop1;
	return moveTuple;
}

function filtBtn0(self, targ, handle, onlyTarg = true) {
	return e => {
		e.button == 0 && (!onlyTarg || e.target == targ) && handle(e);
	};
}

function filtTarg(self, targ, handle, onlyTarg = true) {
	return e => {
		(!onlyTarg || e.target == targ) && handle(e);
	};
}

const cursorOpts = {
	show: true,
	x: true,
	y: true,
	lock: false,
	move: cursorMove,
	points: {
		one:    false,
		show:   cursorPointShow,
		size:   cursorPointSize,
		width:  0,
		stroke: cursorPointStroke,
		fill:   cursorPointFill,
	},

	bind: {
		mousedown:   filtBtn0,
		mouseup:     filtBtn0,
		click:       filtBtn0, // legend clicks, not .u-over clicks
		dblclick:    filtBtn0,

		mousemove:   filtTarg,
		mouseleave:  filtTarg,
		mouseenter:  filtTarg,
	},

	drag: {
		setScale: true,
		x: true,
		y: false,
		dist: 0,
		uni: null,
		click: (self, e) => {
		//	e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		},
		_x: false,
		_y: false,
	},

	focus: {
		dist: (self, seriesIdx, dataIdx, valPos, curPos) => valPos - curPos,
		prox: -1,
		bias: 0,
	},

	hover: {
		skip: [void 0],
		prox: null,
		bias: 0,
	},

	left: -10,
	top: -10,
	idx: null,
	dataIdx: null,
	idxs: null,

	event: null,
};

const axisLines = {
	show: true,
	stroke: "rgba(0,0,0,0.07)",
	width: 2,
//	dash: [],
};

const grid = assign({}, axisLines, {
	filter: retArg1,
});

assign({}, grid, {
	size: 10,
});

assign({}, axisLines, {
	show: false,
});

const numSeriesLabel = "Value";
const timeSeriesLabel = "Time";

const xSeriesOpts = {
	show: true,
	scale: "x",
	auto: false,
	sorted: 1,
//	label: "Time",
//	value: v => stamp(new Date(v * 1e3)),

	// internal caches
	min: inf,
	max: -inf,
	idxs: [],
};

function numAxisVals(self, splits, axisIdx, foundSpace, foundIncr) {
	return splits.map(v => v == null ? "" : fmtNum(v));
}

function numAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
	let splits = [];

	let numDec = fixedDec.get(foundIncr) || 0;

	scaleMin = forceMin ? scaleMin : roundDec(incrRoundUp(scaleMin, foundIncr), numDec);

	for (let val = scaleMin; val <= scaleMax; val = roundDec(val + foundIncr, numDec))
		splits.push(Object.is(val, -0) ? 0 : val);		// coalesces -0

	return splits;
}

// this doesnt work for sin, which needs to come off from 0 independently in pos and neg dirs
function logAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
	const splits = [];

	const logBase = self.scales[self.axes[axisIdx].scale].log;

	const logFn = logBase == 10 ? log10 : log2;

	const exp = floor(logFn(scaleMin));

	foundIncr = pow(logBase, exp);

	// boo: 10 ** -24 === 1.0000000000000001e-24
	// this grabs the proper 1e-24 one
	if (logBase == 10)
		foundIncr = numIncrs[closestIdx(foundIncr, numIncrs)];

	let split = scaleMin;
	let nextMagIncr = foundIncr * logBase;

	if (logBase == 10)
		nextMagIncr = numIncrs[closestIdx(nextMagIncr, numIncrs)];

	do {
		splits.push(split);
		split = split + foundIncr;

		if (logBase == 10 && !fixedDec.has(split))
			split = roundDec(split, fixedDec.get(foundIncr));

		if (split >= nextMagIncr) {
			foundIncr = split;
			nextMagIncr = foundIncr * logBase;

			if (logBase == 10)
				nextMagIncr = numIncrs[closestIdx(nextMagIncr, numIncrs)];
		}
	} while (split <= scaleMax);

	return splits;
}

function asinhAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
	let sc = self.scales[self.axes[axisIdx].scale];

	let linthresh = sc.asinh;

	let posSplits = scaleMax > linthresh ? logAxisSplits(self, axisIdx, max(linthresh, scaleMin), scaleMax, foundIncr) : [linthresh];
	let zero = scaleMax >= 0 && scaleMin <= 0 ? [0] : [];
	let negSplits = scaleMin < -linthresh ? logAxisSplits(self, axisIdx, max(linthresh, -scaleMax), -scaleMin, foundIncr): [linthresh];

	return negSplits.reverse().map(v => -v).concat(zero, posSplits);
}

const RE_ALL   = /./;
const RE_12357 = /[12357]/;
const RE_125   = /[125]/;
const RE_1     = /1/;

const _filt = (splits, distr, re, keepMod) => splits.map((v, i) => ((distr == 4 && v == 0) || i % keepMod == 0 && re.test(v.toExponential()[v < 0 ? 1 : 0])) ? v : null);

function log10AxisValsFilt(self, splits, axisIdx, foundSpace, foundIncr) {
	let axis = self.axes[axisIdx];
	let scaleKey = axis.scale;
	let sc = self.scales[scaleKey];

//	if (sc.distr == 3 && sc.log == 2)
//		return splits;

	let valToPos = self.valToPos;

	let minSpace = axis._space;

	let _10 = valToPos(10, scaleKey);

	let re = (
		valToPos(9, scaleKey) - _10 >= minSpace ? RE_ALL :
		valToPos(7, scaleKey) - _10 >= minSpace ? RE_12357 :
		valToPos(5, scaleKey) - _10 >= minSpace ? RE_125 :
		RE_1
	);

	if (re == RE_1) {
		let magSpace = abs(valToPos(1, scaleKey) - _10);

		if (magSpace < minSpace)
			return _filt(splits.slice().reverse(), sc.distr, re, ceil(minSpace / magSpace)).reverse(); // max->min skip
	}

	return _filt(splits, sc.distr, re, 1);
}

function log2AxisValsFilt(self, splits, axisIdx, foundSpace, foundIncr) {
	let axis = self.axes[axisIdx];
	let scaleKey = axis.scale;
	let minSpace = axis._space;
	let valToPos = self.valToPos;

	let magSpace = abs(valToPos(1, scaleKey) - valToPos(2, scaleKey));

	if (magSpace < minSpace)
		return _filt(splits.slice().reverse(), 3, RE_ALL, ceil(minSpace / magSpace)).reverse(); // max->min skip

	return splits;
}

function numSeriesVal(self, val, seriesIdx, dataIdx) {
	return dataIdx == null ? LEGEND_DISP : val == null ? "" : fmtNum(val);
}

// takes stroke width
function ptDia(width, mult) {
	let dia = 3 + (width || 1) * 2;
	return roundDec(dia * mult, 3);
}

function seriesPointsShow(self, si) {
	let { scale, idxs } = self.series[0];
	let xData = self._data[0];
	let p0 = self.valToPos(xData[idxs[0]], scale, true);
	let p1 = self.valToPos(xData[idxs[1]], scale, true);
	let dim = abs(p1 - p0);

	let s = self.series[si];
//	const dia = ptDia(s.width, self.pxRatio);
	let maxPts = dim / (s.points.space * self.pxRatio);
	return idxs[1] - idxs[0] <= maxPts;
}

const facet = {
	scale: null,
	auto: true,
	sorted: 0,

	// internal caches
	min: inf,
	max: -inf,
};

const gaps = (self, seriesIdx, idx0, idx1, nullGaps) => nullGaps;

const xySeriesOpts = {
	show: true,
	auto: true,
	sorted: 0,
	gaps,
	alpha: 1,
	facets: [
		assign({}, facet, {scale: 'x'}),
		assign({}, facet, {scale: 'y'}),
	],
};

const ySeriesOpts = {
	scale: "y",
	auto: true,
	sorted: 0,
	show: true,
	spanGaps: false,
	gaps,
	alpha: 1,
	points: {
		show: seriesPointsShow,
		filter: null,
	//  paths:
	//	stroke: "#000",
	//	fill: "#fff",
	//	width: 1,
	//	size: 10,
	},
//	label: "Value",
//	value: v => v,
	values: null,

	// internal caches
	min: inf,
	max: -inf,
	idxs: [],

	path: null,
	clip: null,
};

function clampScale(self, val, scaleMin, scaleMax, scaleKey) {
/*
	if (val < 0) {
		let cssHgt = self.bbox.height / self.pxRatio;
		let absPos = self.valToPos(abs(val), scaleKey);
		let fromBtm = cssHgt - absPos;
		return self.posToVal(cssHgt + fromBtm, scaleKey);
	}
*/
	return scaleMin / 10;
}

const xScaleOpts = {
	time: FEAT_TIME,
	auto: true,
	distr: 1,
	log: 10,
	asinh: 1,
	min: null,
	max: null,
	dir: 1,
	ori: 0,
};

const yScaleOpts = assign({}, xScaleOpts, {
	time: false,
	ori: 1,
});

// Snap functions for different scale types
function snapNumX(self, dataMin, dataMax) {
	return dataMin == null ? nullNullTuple : [dataMin, dataMax];
}

const snapTimeX = snapNumX;

// this ensures that non-temporal/numeric y-axes get multiple-snapped padding added above/below
// TODO: also account for incrs when snapping to ensure top of axis gets a tick & value
function snapNumY(self, dataMin, dataMax) {
	return dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, rangePad, true);
}

function snapLogY(self, dataMin, dataMax, scale) {
	return dataMin == null ? nullNullTuple : rangeLog(dataMin, dataMax, self.scales[scale].log, true);
}

const snapLogX = snapLogY;

function snapAsinhY(self, dataMin, dataMax, scale) {
	return dataMin == null ? nullNullTuple : rangeAsinh(dataMin, dataMax, self.scales[scale].log, true);
}

const snapAsinhX = snapAsinhY;

/**
 * Scale Manager - handles scale initialization, management, and value-to-pixel conversions
 */
class ScaleManager {
	constructor(uplot, opts) {
		try {
			validateRequired(uplot, 'uplot', 'ScaleManager', 'constructor');
			validateRequired(opts, 'opts', 'ScaleManager', 'constructor');
			
			this.uplot = uplot;
			this.opts = opts;
			this.scales = {};
			this.pendScales = {};
			this.viaAutoScaleX = false;
			
			// Mode and scale key references
			this.mode = uplot.mode || 1;
			this.xScaleKey = this.mode == 2 ? 
				(opts.series && opts.series[1] && opts.series[1].facets ? opts.series[1].facets[0].scale : 'x') : 
				(opts.series && opts.series[0] ? opts.series[0].scale : 'x');
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize value-to-percentage conversion function for a scale
	 */
	initValToPct(sc) {
		try {
			validateRequired(sc, 'sc', 'ScaleManager', 'initValToPct');
			
			const getVal = (
				sc.distr == 3   ? val => {
					if (val <= 0 && !sc.clamp) {
						throw new UPlotError(
							`Invalid value ${val} for log scale - must be positive`,
							'ScaleManager',
							{ method: 'initValToPct', scaleKey: sc.key, type: ERROR_TYPES.SCALE_CALCULATION }
						);
					}
					return log10(val > 0 ? val : sc.clamp(this.uplot, val, sc.min, sc.max, sc.key));
				} :
				sc.distr == 4   ? val => asinh(val, sc.asinh) :
				sc.distr == 100 ? val => {
					if (typeof sc.fwd !== 'function') {
						throw new UPlotError(
							'Custom scale missing forward transform function',
							'ScaleManager',
							{ method: 'initValToPct', scaleKey: sc.key, type: ERROR_TYPES.VALIDATION }
						);
					}
					return sc.fwd(val);
				} :
				val => val
			);

			return val => {
				try {
					let _val = getVal(val);
					let { _min, _max } = sc;
					
					if (_min == null || _max == null) {
						throw new UPlotError(
							'Scale not properly initialized - missing min/max values',
							'ScaleManager',
							{ method: 'valToPct', scaleKey: sc.key, type: ERROR_TYPES.SCALE_CALCULATION }
						);
					}
					
					let delta = _max - _min;
					if (delta === 0) {
						return 0.5; // Return middle position for zero range
					}
					
					return (_val - _min) / delta;
				} catch (error) {
					if (error instanceof UPlotError) {
						throw error;
					}
					throw new UPlotError(
						`Error converting value to percentage: ${error.message}`,
						'ScaleManager',
						{ method: 'valToPct', scaleKey: sc.key, value: val, type: ERROR_TYPES.SCALE_CALCULATION },
						error
					);
				}
			};
		} catch (error) {
			errorReporter.reportError(error);
			throw error;
		}
	}

	/**
	 * Initialize a scale with the given key
	 */
	initScale(scaleKey) {
		try {
			validateRequired(scaleKey, 'scaleKey', 'ScaleManager', 'initScale');
			validateType(scaleKey, 'string', 'scaleKey', 'ScaleManager', 'initScale');
			
			let sc = this.scales[scaleKey];

			if (sc == null) {
				let scaleOpts = (this.opts.scales || EMPTY_OBJ)[scaleKey] || EMPTY_OBJ;

				if (scaleOpts.from != null) {
					// Validate parent scale exists or can be created
					if (scaleOpts.from === scaleKey) {
						throw new UPlotError(
							`Scale '${scaleKey}' cannot reference itself as parent`,
							'ScaleManager',
							{ method: 'initScale', scaleKey, type: ERROR_TYPES.VALIDATION }
						);
					}
					
					// ensure parent is initialized
					this.initScale(scaleOpts.from);
					
					if (!this.scales[scaleOpts.from]) {
						throw new UPlotError(
							`Parent scale '${scaleOpts.from}' could not be initialized`,
							'ScaleManager',
							{ method: 'initScale', scaleKey, parentScale: scaleOpts.from, type: ERROR_TYPES.INITIALIZATION }
						);
					}
					
					// dependent scales inherit
					let sc = assign({}, this.scales[scaleOpts.from], scaleOpts, {key: scaleKey});
					sc.valToPct = this.initValToPct(sc);
					this.scales[scaleKey] = sc;
				}
				else {
					sc = this.scales[scaleKey] = assign({}, (scaleKey == this.xScaleKey ? xScaleOpts : yScaleOpts), scaleOpts);

					sc.key = scaleKey;

					let isTime = FEAT_TIME && sc.time;

					let rn = sc.range;

					let rangeIsArr = isArr(rn);

					if (scaleKey != this.xScaleKey || (this.mode == 2 && !isTime)) {
						// if range array has null limits, it should be auto
						if (rangeIsArr && (rn[0] == null || rn[1] == null)) {
							rn = {
								min: rn[0] == null ? autoRangePart : {
									mode: 1,
									hard: rn[0],
									soft: rn[0],
								},
								max: rn[1] == null ? autoRangePart : {
									mode: 1,
									hard: rn[1],
									soft: rn[1],
								},
							};
							rangeIsArr = false;
						}

						if (!rangeIsArr && isObj(rn)) {
							let cfg = rn;
							// this is similar to snapNumY
							rn = (self, dataMin, dataMax) => dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, cfg);
						}
					}

					sc.range = fnOrSelf(rn || (isTime ? snapTimeX : scaleKey == this.xScaleKey ?
						(sc.distr == 3 ? snapLogX : sc.distr == 4 ? snapAsinhX : snapNumX) :
						(sc.distr == 3 ? snapLogY : sc.distr == 4 ? snapAsinhY : snapNumY)
					));

					sc.auto = fnOrSelf(rangeIsArr ? false : sc.auto);

					sc.clamp = fnOrSelf(sc.clamp || clampScale);

					// caches for expensive ops like asinh() & log()
					sc._min = sc._max = null;

					sc.valToPct = this.initValToPct(sc);
				}
			}
		} catch (error) {
			errorReporter.reportError(error);
			throw error;
		}
	}

	/**
	 * Initialize all required scales
	 */
	initScales() {
		// Initialize base scales
		this.initScale("x");
		this.initScale("y");

		// Initialize series scales in mode 1
		if (this.mode == 1 && this.uplot.series && Array.isArray(this.uplot.series)) {
			this.uplot.series.forEach(s => {
				if (s && s.scale) {
					this.initScale(s.scale);
				}
			});
		}

		// Initialize axis scales
		if (this.uplot.axes?.axes && Array.isArray(this.uplot.axes.axes)) {
			this.uplot.axes.axes.forEach(a => {
				if (a && a.scale) {
					this.initScale(a.scale);
				}
			});
		}

		// Initialize any additional scales from options
		for (let k in (this.opts.scales || {})) {
			this.initScale(k);
		}

		// Set up explicitly-set initial scales
		for (let k in this.scales) {
			let sc = this.scales[k];

			if (sc.min != null || sc.max != null) {
				this.pendScales[k] = {min: sc.min, max: sc.max};
				sc.min = sc.max = null;
			}
		}
	}

	/**
	 * Get horizontal position from value
	 */
	getHPos(val, scale, dim, off) {
		let pct = scale.valToPct(val);
		return off + dim * (scale.dir == -1 ? (1 - pct) : pct);
	}

	/**
	 * Get vertical position from value
	 */
	getVPos(val, scale, dim, off) {
		let pct = scale.valToPct(val);
		return off + dim * (scale.dir == -1 ? pct : (1 - pct));
	}

	/**
	 * Get position from value (orientation-aware)
	 */
	getPos(val, scale, dim, off) {
		return scale.ori == 0 ? this.getHPos(val, scale, dim, off) : this.getVPos(val, scale, dim, off);
	}

	/**
	 * Convert value to X position
	 */
	valToPosX(val, scale, dim, off) {
		const scaleX = this.scales[this.xScaleKey];
		return scaleX.ori == 0 ? this.getHPos(val, scale, dim, off) : this.getVPos(val, scale, dim, off);
	}

	/**
	 * Convert value to Y position
	 */
	valToPosY(val, scale, dim, off) {
		const scaleX = this.scales[this.xScaleKey];
		return scaleX.ori == 0 ? this.getVPos(val, scale, dim, off) : this.getHPos(val, scale, dim, off);
	}

	/**
	 * Convert position to value
	 */
	posToVal(pos, scaleKey, can) {
		return withErrorBoundary('ScaleManager', 'posToVal', function(pos, scaleKey, can) {
			validateRequired(pos, 'pos', 'ScaleManager', 'posToVal');
			validateRequired(scaleKey, 'scaleKey', 'ScaleManager', 'posToVal');
			validateType(pos, 'number', 'pos', 'ScaleManager', 'posToVal');
			validateType(scaleKey, 'string', 'scaleKey', 'ScaleManager', 'posToVal');
			
			let sc = this.scales[scaleKey];
			
			if (!sc) {
				throw new UPlotError(
					`Scale '${scaleKey}' not found`,
					'ScaleManager',
					{ method: 'posToVal', scaleKey, type: ERROR_TYPES.VALIDATION }
				);
			}

			let dim, off;

			if (can) {
				let bbox = this.uplot.bbox || {};
				dim = sc.ori == 0 ? bbox.width : bbox.height;
				off = sc.ori == 0 ? bbox.left : bbox.top;
			}
			else {
				let layout = this.uplot.layout || this.uplot;
				dim = sc.ori == 0 ? layout.plotWidCss : layout.plotHgtCss;
				off = sc.ori == 0 ? layout.plotLftCss : layout.plotTopCss;
			}

			if (dim === 0) {
				throw new UPlotError(
					'Cannot convert position to value - plot dimension is zero',
					'ScaleManager',
					{ method: 'posToVal', scaleKey, dimension: dim, type: ERROR_TYPES.SCALE_CALCULATION }
				);
			}

			let pct = (pos - off) / dim;

			if (sc.dir == -1)
				pct = 1 - pct;

			if (sc.ori == 1)
				pct = 1 - pct;

			let { _min, _max } = sc;
			
			if (_min == null || _max == null) {
				throw new UPlotError(
					'Scale not properly initialized - missing min/max values',
					'ScaleManager',
					{ method: 'posToVal', scaleKey, type: ERROR_TYPES.SCALE_CALCULATION }
				);
			}

			let val = _min + (_max - _min) * pct;

			return (
				sc.distr == 3 ? Math.pow(10, val) :
				sc.distr == 4 ? Math.sinh(val) :
				sc.distr == 100 ? (
					typeof sc.inv === 'function' ? sc.inv(val) : 
					(() => {
						throw new UPlotError(
							'Custom scale missing inverse transform function',
							'ScaleManager',
							{ method: 'posToVal', scaleKey, type: ERROR_TYPES.VALIDATION }
						);
					})()
				) :
				val
			);
		}).call(this, pos, scaleKey, can);
	}

	/**
	 * Convert X position to value
	 */
	posToValX(pos, can) {
		return this.posToVal(pos, this.xScaleKey, can);
	}

	/**
	 * Convert Y position to value
	 */
	posToValY(pos, scaleKey, can) {
		return this.posToVal(pos, scaleKey, can);
	}

	/**
	 * Auto-scale X axis
	 */
	autoScaleX() {
		this.viaAutoScaleX = true;

		let _min, _max;

		const data = this.uplot.data || [];
		const scaleX = this.scales[this.xScaleKey];

		if (data.length > 0 && data[0] && data[0].length > 0) {
			// Get data range
			let xData = data[0];
			_min = xData[0];
			_max = xData[xData.length - 1];

			// Apply scale range function
			if (scaleX.range) {
				let range = scaleX.range(this.uplot, _min, _max, scaleX.key);
				if (range) {
					_min = range[0];
					_max = range[1];
				}
			}
		}
		else {
			_min = _max = null;
		}

		this._setScale(this.xScaleKey, _min, _max);
	}

	/**
	 * Set scale with min/max values
	 */
	_setScale(key, min, max) {
		this.setScale(key, {min, max});
	}

	/**
	 * Set scale with options
	 */
	setScale(key, opts) {
		let sc = this.scales[key];

		if (sc != null) {
			// Validate and process options
			if (opts.min != null || opts.max != null) {
				if (opts.min != null && opts.max != null && opts.min > opts.max) {
					// Swap if min > max
					let tmp = opts.min;
					opts.min = opts.max;
					opts.max = tmp;
				}
			}

			// Queue the scale change
			this.pendScales[key] = opts;
			
			// Mark that scales need to be set
			this.uplot.shouldSetScales = true;
		}
	}

	/**
	 * Process pending scale changes
	 */
	setScales() {
		const AUTOSCALE = {min: null, max: null};

		// Add auto scales and unranged scales
		for (let k in this.scales) {
			let sc = this.scales[k];

			if (
				this.pendScales[k] == null && (
					sc.min == null ||
					// or auto scales when the x scale was explicitly set
					this.pendScales[this.xScaleKey] != null && sc.auto(this.uplot, this.viaAutoScaleX)
				)
			) {
				this.pendScales[k] = AUTOSCALE;
			}
		}

		// Handle dependent scales
		for (let k in this.pendScales) {
			let sc = this.scales[k];

			if (this.pendScales[k] == null && sc.from != null && this.pendScales[sc.from] != null) {
				this.pendScales[k] = AUTOSCALE;
			}
		}

		// Process scale changes
		let changed = {};

		for (let k in this.pendScales) {
			let sc = this.scales[k];
			let opts = this.pendScales[k];

			if (opts.min != null || opts.max != null) {
				// Apply the scale change
				if (opts.min != null) {
					sc.min = opts.min;
					sc._min = sc.distr == 3 ? log10(sc.min) : sc.distr == 4 ? asinh(sc.min, sc.asinh) : sc.min;
				}

				if (opts.max != null) {
					sc.max = opts.max;
					sc._max = sc.distr == 3 ? log10(sc.max) : sc.distr == 4 ? asinh(sc.max, sc.asinh) : sc.max;
				}

				changed[k] = true;
			}
		}

		// Clear pending scales
		this.pendScales = {};
		this.viaAutoScaleX = false;

		return changed;
	}

	/**
	 * Get scale by key
	 */
	getScale(key) {
		return this.scales[key];
	}

	/**
	 * Get X scale
	 */
	getXScale() {
		return this.scales[this.xScaleKey];
	}

	/**
	 * Get all scales
	 */
	getAllScales() {
		return this.scales;
	}

	/**
	 * Check if scale exists
	 */
	hasScale(key) {
		return this.scales[key] != null;
	}

	/**
	 * Update scale options
	 */
	updateScale(key, opts) {
		let sc = this.scales[key];
		if (sc != null) {
			assign(sc, opts);
			// Reinitialize valToPct if needed
			if (opts.distr != null || opts.asinh != null) {
				sc.valToPct = this.initValToPct(sc);
			}
		}
	}
}

/**
 * EventManager handles all mouse and touch event binding, unbinding, and processing
 * for uPlot instances. It manages event listeners, coordinates with cursor system,
 * and handles drag operations.
 */
class EventManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'EventManager', 'constructor');
			
			this.uplot = uplot;
			this.mouseListeners = new Map();
			this.globalListeners = new Set();
			this.dragging = false;
			
			// Mouse position tracking
			this.rawMouseLeft0 = 0;
			this.rawMouseTop0 = 0;
			this.mouseLeft0 = 0;
			this.mouseTop0 = 0;
			this.rawMouseLeft1 = 0;
			this.rawMouseTop1 = 0;
			this.mouseLeft1 = 0;
			this.mouseTop1 = 0;
			
			// Drag state
			this.dragX = false;
			this.dragY = false;
			this.downSelectLeft = 0;
			this.downSelectTop = 0;
			this.downSelectWidth = 0;
			this.downSelectHeight = 0;
			
			// Cached rect for performance
			this.rect = null;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize event handling system
	 */
	initEvents(opts) {
		return withErrorBoundary('EventManager', 'initEvents', function(opts) {
			validateRequired(opts, 'opts', 'EventManager', 'initEvents');
			
			const { cursor, over, wrap } = this.uplot;
			
			if (!cursor) {
				throw new UPlotError(
					'Cursor configuration not available',
					'EventManager',
					{ method: 'initEvents', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			if (!over) {
				throw new UPlotError(
					'Over element not available for event binding',
					'EventManager',
					{ method: 'initEvents', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			if (!cursor.show) {
				return;
			}

			try {
				// Bind main cursor events
				this.onMouse(mousedown, over, this.mouseDown.bind(this));
				this.onMouse(mousemove, over, this.mouseMove.bind(this));
				this.onMouse(mouseenter, over, this.mouseEnter.bind(this));
				this.onMouse(mouseleave, over, this.mouseLeave.bind(this));
				this.onMouse(dblclick, over, this.dblClick.bind(this));

				// Touch event support
				this.initTouchEvents(over);

				// Bind click handler for drag operations
				if (wrap) {
					on("click", wrap, this.handleWrapClick.bind(this), true);
				}

				// Global window events for invalidation
				if (domEnv) {
					this.bindGlobalEvent(resize, win, this.invalidateRects.bind(this));
					this.bindGlobalEvent(scroll, win, this.invalidateRects.bind(this), true);
					this.bindGlobalEvent(dppxchange, win, this.onDppxChange.bind(this));
				}
			} catch (error) {
				throw new UPlotError(
					`Error initializing events: ${error.message}`,
					'EventManager',
					{ method: 'initEvents', type: ERROR_TYPES.EVENT_HANDLING },
					error
				);
			}
		}).call(this, opts);
	}

	/**
	 * Initialize touch event support
	 */
	initTouchEvents(target) {
		// Touch events are handled by converting them to mouse events
		// This provides basic touch support for mobile devices
		
		const touchToMouse = (touchEvent, mouseEventType) => {
			if (touchEvent.touches.length === 1) {
				const touch = touchEvent.touches[0];
				const mouseEvent = new MouseEvent(mouseEventType, {
					clientX: touch.clientX,
					clientY: touch.clientY,
					button: 0,
					buttons: 1,
					bubbles: true,
					cancelable: true
				});
				
				// Prevent default touch behavior
				touchEvent.preventDefault();
				
				// Dispatch the synthetic mouse event
				target.dispatchEvent(mouseEvent);
			}
		};

		// Convert touch events to mouse events
		on('touchstart', target, (e) => touchToMouse(e, 'mousedown'));
		on('touchmove', target, (e) => touchToMouse(e, 'mousemove'));
		on('touchend', target, (e) => {
			// For touchend, we need to use changedTouches
			if (e.changedTouches.length === 1) {
				const touch = e.changedTouches[0];
				const mouseEvent = new MouseEvent('mouseup', {
					clientX: touch.clientX,
					clientY: touch.clientY,
					button: 0,
					buttons: 0,
					bubbles: true,
					cancelable: true
				});
				
				e.preventDefault();
				target.dispatchEvent(mouseEvent);
			}
		});
	}

	/**
	 * Bind mouse event with cursor configuration
	 */
	onMouse(ev, targ, fn, onlyTarg = true) {
		const { cursor } = this.uplot;
		const targListeners = this.mouseListeners.get(targ) || {};
		const listener = cursor.bind[ev](this.uplot, targ, fn, onlyTarg);

		if (listener) {
			on(ev, targ, targListeners[ev] = listener);
			this.mouseListeners.set(targ, targListeners);
		}
	}

	/**
	 * Unbind mouse events
	 */
	offMouse(ev, targ) {
		const targListeners = this.mouseListeners.get(targ) || {};

		for (let k in targListeners) {
			if (ev == null || k == ev) {
				off(k, targ, targListeners[k]);
				delete targListeners[k];
			}
		}

		if (ev == null) {
			this.mouseListeners.delete(targ);
		}
	}

	/**
	 * Bind global window events
	 */
	bindGlobalEvent(event, target, handler, useCapture = false) {
		on(event, target, handler, useCapture);
		this.globalListeners.add({ event, target, handler, useCapture });
	}

	/**
	 * Handle wrap click events for drag operations
	 */
	handleWrapClick(e) {
		const { over, cursor } = this.uplot;
		
		if (e.target === over) {
			let didDrag = this.mouseLeft1 != this.mouseLeft0 || this.mouseTop1 != this.mouseTop0;
			didDrag && cursor.drag.click(this.uplot, e);
		}
	}

	/**
	 * Mouse down event handler
	 */
	mouseDown(e, src, _l, _t, _w, _h, _i) {
		return withErrorBoundary('EventManager', 'mouseDown', function(e, src, _l, _t, _w, _h, _i) {
			const { cursor } = this.uplot;
			
			if (!cursor || !cursor.drag) {
				throw new UPlotError(
					'Cursor or drag configuration not available',
					'EventManager',
					{ method: 'mouseDown', type: ERROR_TYPES.EVENT_HANDLING }
				);
			}
			
			try {
				this.dragging = true;
				this.dragX = this.dragY = cursor.drag._x = cursor.drag._y = false;

				let left = _l ?? this.mouseLeft1;
				let top = _t ?? this.mouseTop1;

				this.rawMouseLeft0 = this.rawMouseLeft1 = this.mouseLeft0 = this.mouseLeft1 = left;
				this.rawMouseTop0 = this.rawMouseTop1 = this.mouseTop0 = this.mouseTop1 = top;

				this.downSelectLeft = left;
				this.downSelectTop = top;
				this.downSelectWidth = 0;
				this.downSelectHeight = 0;

				if (e != null) {
					this.onMouse(mouseup, doc, this.mouseUp.bind(this), false);
					
					if (typeof this.uplot.pubSync === 'function') {
						this.uplot.pubSync(mousedown, this.uplot, this.mouseLeft0, this.mouseTop0, 
							this.uplot.plotWidCss, this.uplot.plotHgtCss, null);
					}
				}
			} catch (error) {
				throw new UPlotError(
					`Error handling mouse down: ${error.message}`,
					'EventManager',
					{ method: 'mouseDown', type: ERROR_TYPES.EVENT_HANDLING },
					error
				);
			}
		}).call(this, e, src, _l, _t, _w, _h, _i);
	}

	/**
	 * Mouse move event handler
	 */
	mouseMove(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		if (cursor._lock) {
			return;
		}

		this.setCursorEvent(e);

		// Ignore phantom mousemove events on touch devices
		if (this.dragging && e != null && e.movementX == 0 && e.movementY == 0) {
			return;
		}

		this.syncRect(false);

		let left, top;

		if (e != null) {
			left = e.clientX - this.rect.left;
			top = e.clientY - this.rect.top;
		} else {
			left = _l;
			top = _t;
			this.syncRect(true);
		}

		if (left < 0 || top < 0) {
			left = -10;
			top = -10;
		}

		this.mouseLeft1 = left;
		this.mouseTop1 = top;

		this.updateCursor(null, src == null, src != null);
	}

	/**
	 * Mouse up event handler
	 */
	mouseUp(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		this.dragging = cursor.drag._x = cursor.drag._y = false;

		let left = _l ?? this.mouseLeft1;
		let top = _t ?? this.mouseTop1;

		this.rawMouseLeft1 = this.mouseLeft1 = left;
		this.rawMouseTop1 = this.mouseTop1 = top;

		// Handle selection
		if (cursor.drag.setScale) {
			let deltaX = this.mouseLeft1 - this.mouseLeft0;
			let deltaY = this.mouseTop1 - this.mouseTop0;

			if (this.dragX && Math.abs(deltaX) >= cursor.drag.dist) {
				this.setSelect({
					left: Math.min(this.mouseLeft0, this.mouseLeft1),
					width: Math.abs(deltaX),
					top: cursor.drag.y ? Math.min(this.mouseTop0, this.mouseTop1) : 0,
					height: cursor.drag.y ? Math.abs(deltaY) : this.uplot.plotHgtCss,
				}, false);
			}
		}

		if (e != null) {
			this.offMouse(mouseup, doc);
			this.uplot.pubSync(mouseup, this.uplot, this.mouseLeft1, this.mouseTop1, 
				this.uplot.plotWidCss, this.uplot.plotHgtCss, null);
		}
	}

	/**
	 * Mouse leave event handler
	 */
	mouseLeave(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		if (cursor._lock) {
			return;
		}

		this.setCursorEvent(e);

		if (!this.dragging) {
			this.rawMouseLeft1 = this.mouseLeft1 = -10;
			this.rawMouseTop1 = this.mouseTop1 = -10;

			// Only fire on actual mouse leave, not programmatic
			this.updateCursor(null, src == null, src != null);
		}
	}

	/**
	 * Mouse enter event handler
	 */
	mouseEnter(e) {
		this.setCursorEvent(e);
		this.syncRect(false);
	}

	/**
	 * Double click event handler
	 */
	dblClick(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		if (cursor._lock) {
			return;
		}

		this.setCursorEvent(e);

		let left = _l ?? this.mouseLeft1;
		let top = _t ?? this.mouseTop1;

		this.rawMouseLeft1 = this.mouseLeft1 = left;
		this.rawMouseTop1 = this.mouseTop1 = top;

		this.updateCursor(null, src == null, src != null);

		this.uplot.pubSync(dblclick, this.uplot, this.mouseLeft1, this.mouseTop1, 
			this.uplot.plotWidCss, this.uplot.plotHgtCss, null);
	}

	/**
	 * Set cursor event reference
	 */
	setCursorEvent(e) {
		this.uplot.cursor.event = e;
	}

	/**
	 * Update cursor position and trigger cursor update
	 */
	updateCursor(ts, _fire, _pub) {
		this.rawMouseLeft1 = this.mouseLeft1;
		this.rawMouseTop1 = this.mouseTop1;

		[this.mouseLeft1, this.mouseTop1] = this.uplot.cursor.move(
			this.uplot, this.mouseLeft1, this.mouseTop1
		);

		this.uplot.cursor.left = this.mouseLeft1;
		this.uplot.cursor.top = this.mouseTop1;

		// Delegate to uPlot's updateCursor method
		if (this.uplot.updateCursor) {
			this.uplot.updateCursor(ts, _fire, _pub);
		}
	}

	/**
	 * Sync bounding rect cache
	 */
	syncRect(force) {
		if (force || this.rect == null) {
			this.rect = this.uplot.over.getBoundingClientRect();
			this.uplot.fire("syncRect", this.rect);
		}
	}

	/**
	 * Set selection area
	 */
	setSelect(opts, _fire) {
		// Delegate to uPlot's setSelect method
		if (this.uplot.setSelect) {
			this.uplot.setSelect(opts, _fire);
		}
	}

	/**
	 * Handle DPR change events
	 */
	onDppxChange() {
		// Update pixel ratio - this will be handled by main uPlot instance
		if (this.uplot.setPxRatio) {
			this.uplot.setPxRatio();
		}
	}

	/**
	 * Invalidate cached rects for all cursor plots
	 */
	invalidateRects() {
		// This will be handled by the global cursor plots set
		// Individual instances don't need to track this
		if (this.uplot.syncRect) {
			this.uplot.syncRect(true);
		}
	}

	/**
	 * Get current mouse position
	 */
	getMousePos() {
		return {
			left: this.mouseLeft1,
			top: this.mouseTop1,
			rawLeft: this.rawMouseLeft1,
			rawTop: this.rawMouseTop1
		};
	}

	/**
	 * Get drag state
	 */
	getDragState() {
		return {
			dragging: this.dragging,
			dragX: this.dragX,
			dragY: this.dragY,
			startLeft: this.mouseLeft0,
			startTop: this.mouseTop0
		};
	}

	/**
	 * Clean up all event listeners
	 */
	destroy() {
		// Remove all mouse listeners
		for (let [targ] of this.mouseListeners) {
			this.offMouse(null, targ);
		}
		this.mouseListeners.clear();

		// Remove global listeners
		for (let { event, target, handler, useCapture } of this.globalListeners) {
			off(event, target, handler, useCapture);
		}
		this.globalListeners.clear();
	}
}

/**
 * Cursor Manager - handles cursor positioning, mouse interactions, and data point highlighting
 */


class CursorManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'CursorManager', 'constructor');
			
			this.uplot = uplot;
			
			// Cursor configuration
			this.cursor = null;
			this.showCursor = false;
			this.cursorFocus = false;
			this.cursorOnePt = false;
			
			// Cursor DOM elements
			this.vCursor = null;
			this.hCursor = null;
			this.cursorPts = [];
			this.cursorPtsLft = [];
			this.cursorPtsTop = [];
			
			// Mouse state
			this.mouseLeft1 = -10;
			this.mouseTop1 = -10;
			this.rawMouseLeft1 = -10;
			this.rawMouseTop1 = -10;
			
			// Rect cache
			this.rect = null;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	initCursor(opts, series, activeIdxs, mode, over, focus) {
		this.cursor = assign({}, cursorOpts, {drag: {y: mode == 2}}, opts.cursor);
		this.showCursor = this.cursor.show;
		
		// Initialize cursor properties
		this.cursor.idxs = activeIdxs;
		this.cursor._lock = false;
		
		// Initialize points configuration
		let points = this.cursor.points;
		points.show = fnOrSelf(points.show);
		points.size = fnOrSelf(points.size);
		points.stroke = fnOrSelf(points.stroke);
		points.fill = fnOrSelf(points.fill);
		
		// Initialize focus
		this.cursorFocus = focus.prox >= 0;
		this.cursorOnePt = this.cursorFocus && points.one;
		
		// Initialize cursor DOM elements
		if (this.showCursor) {
			if (this.cursor.x) {
				this.vCursor = placeDiv(CURSOR_X, over);
			}
			
			if (this.cursor.y) {
				this.hCursor = placeDiv(CURSOR_Y, over);
			}
		}
		
		// Initialize data index function if not provided
		if (this.cursor.dataIdx == null) {
			this.cursor.dataIdx = this.createDataIdxFunction();
		}
		
		return this.cursor;
	}

	createDataIdxFunction() {
		return (self, seriesIdx, cursorIdx, valAtPosX) => {
			if (seriesIdx == 0) {
				return cursorIdx;
			}

			let idx2 = cursorIdx;
			let series = self.series;
			let data = self.data;
			let scaleX = self.scales[series[0].scale];
			let plotWidCss = self.plotWidCss;
			let plotHgtCss = self.plotHgtCss;

			let prox = self.series[seriesIdx].prox || (() => 1);
			let _prox = prox(self, seriesIdx, cursorIdx, valAtPosX) ?? inf;
			let withProx = _prox >= 0 && _prox < inf;
			let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss;
			let cursorLft = this.cursor.left;

			let xValues = data[0];
			let yValues = data[seriesIdx];
			let hov = this.cursor.hover;
			let skip = hov.skip = new Set(hov.skip ?? []);

			if (skip.has(yValues[cursorIdx])) {
				idx2 = null;

				let nonNullLft = null;
				let nonNullRgt = null;
				let bias = hov.bias;

				if (bias == 0 || bias == -1) {
					let j = cursorIdx;
					while (nonNullLft == null && j-- > 0) {
						if (!skip.has(yValues[j])) {
							nonNullLft = j;
						}
					}
				}

				if (bias == 0 || bias == 1) {
					let j = cursorIdx;
					while (nonNullRgt == null && j++ < yValues.length) {
						if (!skip.has(yValues[j])) {
							nonNullRgt = j;
						}
					}
				}

				if (nonNullLft != null || nonNullRgt != null) {
					let valToPosX = self.valToPosX;
					let lftPos = nonNullLft == null ? -Infinity : valToPosX(xValues[nonNullLft], scaleX, xDim, 0);
					let rgtPos = nonNullRgt == null ? Infinity : valToPosX(xValues[nonNullRgt], scaleX, xDim, 0);

					let lftDelta = cursorLft - lftPos;
					let rgtDelta = rgtPos - cursorLft;

					if (lftDelta <= rgtDelta) {
						if (nonNullLft != null) {
							idx2 = nonNullLft;
						}
					} else {
						if (nonNullRgt != null) {
							idx2 = nonNullRgt;
						}
					}

					if (idx2 == null) {
						idx2 = nonNullRgt == null ? nonNullLft :
							nonNullLft == null ? nonNullRgt :
							cursorIdx - nonNullLft <= nonNullRgt - cursorIdx ? nonNullLft : nonNullRgt;
					}
				}
			} else if (withProx) {
				let valToPosX = self.valToPosX;
				let dist = abs(cursorLft - valToPosX(xValues[cursorIdx], scaleX, xDim, 0));

				if (dist > _prox) {
					idx2 = null;
				}
			}

			return idx2;
		};
	}

	initCursorPt(s, si, over, plotWidCss, plotHgtCss) {
		let pt = this.cursor.points.show(this.uplot, si);

		if (pt) {
			addClass(pt, CURSOR_PT);
			addClass(pt, s.class);
			elTrans(pt, -10, -10, plotWidCss, plotHgtCss);
			over.insertBefore(pt, this.cursorPts[si]);
		}

		return pt;
	}

	addCursorPt(s, i, over, plotWidCss, plotHgtCss) {
		if (!this.showCursor) return;
		
		let pt = null;

		if (this.cursor.points.show(this.uplot, i)) {
			pt = this.initCursorPt(s, i, over, plotWidCss, plotHgtCss);
		}

		this.cursorPts.splice(i, 0, pt);
		this.cursorPtsLft.splice(i, 0, 0);
		this.cursorPtsTop.splice(i, 0, 0);
	}

	removeCursorPt(i) {
		if (!this.showCursor) return;
		
		let pt = this.cursorPts.splice(i, 1)[0];
		if (pt) {
			pt.remove();
		}
		this.cursorPtsLft.splice(i, 1);
		this.cursorPtsTop.splice(i, 1);
	}

	setCursor(opts, _fire, _pub) {
		return withErrorBoundary('CursorManager', 'setCursor', function(opts, _fire, _pub) {
			validateRequired(opts, 'opts', 'CursorManager', 'setCursor');
			
			if (typeof opts.left !== 'number' || typeof opts.top !== 'number') {
				throw new UPlotError(
					'setCursor requires opts.left and opts.top to be numbers',
					'CursorManager',
					{ method: 'setCursor', opts, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			this.mouseLeft1 = opts.left;
			this.mouseTop1 = opts.top;
			this.updateCursor(null, _fire, _pub);
		}).call(this, opts, _fire, _pub);
	}

	setCursorEvent(e) {
		this.cursor.event = e;
	}

	updateCursor(src, _fire, _pub) {
		return withErrorBoundary('CursorManager', 'updateCursor', function(src, _fire, _pub) {
			if (!this.cursor) {
				throw new UPlotError(
					'Cursor not initialized - call initCursor first',
					'CursorManager',
					{ method: 'updateCursor', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			this.rawMouseLeft1 = this.mouseLeft1;
			this.rawMouseTop1 = this.mouseTop1;

			if (typeof this.cursor.move === 'function') {
				try {
					[this.mouseLeft1, this.mouseTop1] = this.cursor.move(this.uplot, this.mouseLeft1, this.mouseTop1);
				} catch (error) {
					throw new UPlotError(
						`Error in cursor move function: ${error.message}`,
						'CursorManager',
						{ method: 'updateCursor', type: ERROR_TYPES.EVENT_HANDLING },
						error
					);
				}
			}

			this.cursor.left = this.mouseLeft1;
			this.cursor.top = this.mouseTop1;

			if (this.showCursor) {
				// Update cursor lines
				if (this.vCursor) {
					safeExecute('CursorManager', 'updateCursor.vCursor', () => {
						elTrans(this.vCursor, round(this.cursor.left), 0, this.uplot.plotWidCss, this.uplot.plotHgtCss);
					});
				}
				if (this.hCursor) {
					safeExecute('CursorManager', 'updateCursor.hCursor', () => {
						elTrans(this.hCursor, 0, round(this.cursor.top), this.uplot.plotWidCss, this.uplot.plotHgtCss);
					});
				}

				// Hide all cursor points initially
				if (this.uplot.series && Array.isArray(this.uplot.series)) {
					for (let i = 0; i < this.uplot.series.length; i++) {
						let pt = this.cursorPts[i];
						if (pt != null) {
							safeExecute('CursorManager', 'updateCursor.hidePt', () => {
								elTrans(pt, -10, -10, this.uplot.plotWidCss, this.uplot.plotHgtCss);
							});
						}
					}
				}
			}

			// Update cursor data indices and positions
			safeExecute('CursorManager', 'updateCursor.updatePoints', () => {
				this.updateCursorPoints();
			});

			if (_fire !== false && typeof this.uplot.fire === 'function') {
				safeExecute('CursorManager', 'updateCursor.fire', () => {
					this.uplot.fire("setCursor");
				});
			}
		}).call(this, src, _fire, _pub);
	}

	updateCursorPoints() {
		if (!this.showCursor) return;

		let series = this.uplot.series;
		let data = this.uplot.data;
		let activeIdxs = this.uplot.activeIdxs;

		// Find closest data point for each series
		for (let i = 0; i < series.length; i++) {
			let s = series[i];
			
			if (i == 0 || !s.show) continue;

			let idx = activeIdxs[i];
			if (idx == null) continue;

			let src = data[i];
			if (!src || idx >= src.length) continue;

			// Calculate point position
			let scaleX = this.uplot.scales[series[0].scale];
			let scaleY = this.uplot.scales[s.scale];
			
			if (!scaleX || !scaleY) continue;

			let xVal = data[0][idx];
			let yVal = src[idx];

			if (xVal == null || yVal == null) continue;

			let ptLft = this.uplot.valToPosX(xVal, scaleX, this.uplot.plotWidCss, 0);
			let ptTop = this.uplot.valToPosY(yVal, scaleY, this.uplot.plotHgtCss, 0);

			let pt = this.cursorOnePt ? this.cursorPts[0] : this.cursorPts[i];

			if (pt != null) {
				this.cursorPtsLft[i] = ptLft;
				this.cursorPtsTop[i] = ptTop;

				let ptWid = this.cursor.points.size(this.uplot, i);
				let ptHgt = ptWid;

				elSize(pt, ptWid, ptHgt);
				elTrans(pt, ceil(ptLft), ceil(ptTop), this.uplot.plotWidCss, this.uplot.plotHgtCss);

				// Update point styling
				pt.style.borderColor = this.cursor.points.stroke(this.uplot, i);
				pt.style.backgroundColor = this.cursor.points.fill(this.uplot, i);
			}
		}
	}

	syncRect(defer = false) {
		if (defer) {
			this.rect = null;
		} else {
			this.rect = this.uplot.over.getBoundingClientRect();
			this.uplot.fire("syncRect", this.rect);
		}
	}

	getRect() {
		if (this.rect == null) {
			this.syncRect(false);
		}
		return this.rect;
	}

	cacheMouse(e, src, _l, _t, _w, _h, _i, initial, snap) {
		if (this.rect == null) {
			this.syncRect(false);
		}

		this.setCursorEvent(e);

		if (e != null) {
			this.updateCursor(null, true, true);
		} else {
			this.updateCursor(src, true, false);
		}
	}

	setSeriesOpacity(i, value) {
		if (this.showCursor && this.cursorPts[i] != null) {
			this.cursorPts[i].style.opacity = value;
		}
	}

	scaleCursor(pctWid, pctHgt) {
		if (this.showCursor && !this.uplot.shouldSetCursor && this.cursor.left >= 0) {
			this.cursor.left *= pctWid;
			this.cursor.top *= pctHgt;

			this.vCursor && elTrans(this.vCursor, round(this.cursor.left), 0, this.uplot.plotWidCss, this.uplot.plotHgtCss);
			this.hCursor && elTrans(this.hCursor, 0, round(this.cursor.top), this.uplot.plotWidCss, this.uplot.plotHgtCss);

			for (let i = 0; i < this.cursorPts.length; i++) {
				let pt = this.cursorPts[i];

				if (pt != null) {
					this.cursorPtsLft[i] *= pctWid;
					this.cursorPtsTop[i] *= pctHgt;
					elTrans(pt, ceil(this.cursorPtsLft[i]), ceil(this.cursorPtsTop[i]), this.uplot.plotWidCss, this.uplot.plotHgtCss);
				}
			}
		}
	}

	destroy() {
		// Clean up DOM elements
		if (this.vCursor) {
			this.vCursor.remove();
		}
		if (this.hCursor) {
			this.hCursor.remove();
		}
		
		for (let pt of this.cursorPts) {
			if (pt) {
				pt.remove();
			}
		}
		
		// Reset state
		this.cursorPts = [];
		this.cursorPtsLft = [];
		this.cursorPtsTop = [];
		this.cursor = null;
		this.rect = null;
	}
}

/**
 * Legend Manager - handles legend rendering, management, and interactions
 */


class LegendManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'LegendManager', 'constructor');
			
			this.uplot = uplot;
			
			// Legend configuration
			this.legend = null;
			this.showLegend = false;
			this.markers = null;
			
			// Legend DOM elements
			this.legendTable = null;
			this.legendHead = null;
			this.legendBody = null;
			this.legendRows = [];
			this.legendCells = [];
			this.legendCols = null;
			this.multiValLegend = false;
			this.NULL_LEGEND_VALUES = {};
			
			// Mouse event listeners tracking
			this.mouseListeners = new Map();
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	initLegend(opts, series, activeIdxs, mode, root, cursor, syncOpts) {
		return withErrorBoundary('LegendManager', 'initLegend', function(opts, series, activeIdxs, mode, root, cursor, syncOpts) {
			
			validateRequired(opts, 'opts', 'LegendManager', 'initLegend');
			validateRequired(series, 'series', 'LegendManager', 'initLegend');
			validateRequired(activeIdxs, 'activeIdxs', 'LegendManager', 'initLegend');
			validateRequired(root, 'root', 'LegendManager', 'initLegend');
			
			if (!Array.isArray(series)) {
				throw new UPlotError(
					'Series must be an array',
					'LegendManager',
					{ method: 'initLegend', seriesType: typeof series, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (!Array.isArray(activeIdxs)) {
				throw new UPlotError(
					'ActiveIdxs must be an array',
					'LegendManager',
					{ method: 'initLegend', activeIdxsType: typeof activeIdxs, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			try {
				this.legend = assign({}, legendOpts, opts.legend);
				this.showLegend = this.legend.show;
				this.markers = this.legend.markers;
				
				if (this.legend) {
					this.legend.idxs = activeIdxs;
					this.markers.width = fnOrSelf(this.markers.width);
					this.markers.stroke = fnOrSelf(this.markers.stroke);
					this.markers.fill = fnOrSelf(this.markers.fill);
					this.markers.dash = fnOrSelf(this.markers.dash);
				}
				
				// Initialize multi-value legend support
				if (this.legend.live) {
					const getMultiVals = series[1] ? series[1].values : null;
					this.multiValLegend = getMultiVals != null;
					this.legendCols = this.multiValLegend ? getMultiVals(this.uplot, 1, 0) : {_: 0};
					
					for (let k in this.legendCols) {
						this.NULL_LEGEND_VALUES[k] = LEGEND_DISP;
					}
				}
				
				// Create legend DOM structure
				if (this.showLegend) {
					this.legendTable = placeTag("table", LEGEND, root);
					this.legendBody = placeTag("tbody", null, this.legendTable);
					
					// Allow legend to be moved out of root
					if (typeof this.legend.mount === 'function') {
						this.legend.mount(this.uplot, this.legendTable);
					}
					
					if (this.multiValLegend) {
						this.legendHead = placeTag("thead", null, this.legendTable, this.legendBody);
					}
				}
				
				// Initialize legend values array
				this.legend.values = [];
			} catch (error) {
				throw new UPlotError(
					`Error initializing legend: ${error.message}`,
					'LegendManager',
					{ method: 'initLegend', type: ERROR_TYPES.INITIALIZATION },
					error
				);
			}
			
			return this.legend;
		}).call(this, opts, series, activeIdxs, mode, root, cursor, syncOpts);
	}

	initLegendRow(s, i, series, mode, cursor, syncOpts) {
		if (i == 0 && (this.multiValLegend || !this.legend.live || mode == 2)) {
			return [null, null];
		}

		let cells = [];
		let row = placeTag("tr", LEGEND_SERIES, this.legendBody, this.legendBody.childNodes[i]);

		addClass(row, s.class);

		if (!s.show) {
			addClass(row, OFF);
		}

		let label = placeTag("th", null, row);

		// Add marker if enabled
		if (this.markers.show) {
			let indic = placeDiv(LEGEND_MARKER, label);

			if (i > 0) {
				let width = this.markers.width(this.uplot, i);

				if (width) {
					indic.style.border = width + "px " + this.markers.dash(this.uplot, i) + " " + this.markers.stroke(this.uplot, i);
				}

				indic.style.background = this.markers.fill(this.uplot, i);
			}
		}

		// Add label
		let text = placeDiv(LEGEND_LABEL, label);

		if (s.label instanceof HTMLElement) {
			text.appendChild(s.label);
		} else {
			text.textContent = s.label;
		}

		// Add click handler for series toggle
		if (i > 0) {
			if (!this.markers.show) {
				text.style.color = s.width > 0 ? this.markers.stroke(this.uplot, i) : this.markers.fill(this.uplot, i);
			}

			this.onMouse("click", label, e => {
				if (cursor._lock) return;

				this.uplot.setCursorEvent(e);

				let seriesIdx = series.indexOf(s);

				if ((e.ctrlKey || e.metaKey) != this.legend.isolate) {
					// if any other series is shown, isolate this one. else show all
					let isolate = series.some((s, i) => i > 0 && i != seriesIdx && s.show);

					series.forEach((s, i) => {
						i > 0 && this.uplot.setSeries(i, isolate ? (i == seriesIdx ? {show: true} : {show: false}) : {show: true}, true, syncOpts.setSeries);
					});
				} else {
					this.uplot.setSeries(seriesIdx, {show: !s.show}, true, syncOpts.setSeries);
				}
			}, false);

			// Add hover handler for cursor focus
			if (cursor.focus) {
				this.onMouse("mouseenter", label, e => {
					if (cursor._lock) return;

					this.uplot.setCursorEvent(e);
					this.uplot.setSeries(series.indexOf(s), {focus: true}, true, syncOpts.setSeries);
				}, false);
			}
		}

		// Add value cells
		for (var key in this.legendCols) {
			let v = placeTag("td", LEGEND_VALUE, row);
			v.textContent = "--";
			cells.push(v);
		}

		return [row, cells];
	}

	addLegendRow(s, i, series, mode, cursor, syncOpts) {
		if (!this.showLegend) return;
		
		let rowCells = this.initLegendRow(s, i, series, mode, cursor, syncOpts);
		this.legendRows.splice(i, 0, rowCells[0]);
		this.legendCells.splice(i, 0, rowCells[1]);
		this.legend.values.push(null);
	}

	removeLegendRow(i) {
		if (!this.showLegend) return;
		
		this.legend.values.splice(i, 1);
		this.legendCells.splice(i, 1);
		let tr = this.legendRows.splice(i, 1)[0];
		
		if (tr) {
			this.offMouse(null, tr.firstChild);
			tr.remove();
		}
	}

	setLegend(opts, _fire) {
		if (opts != null) {
			if (opts.idxs) {
				opts.idxs.forEach((didx, sidx) => {
					this.uplot.activeIdxs[sidx] = didx;
				});
			} else if (!isUndef(opts.idx)) {
				this.uplot.activeIdxs.fill(opts.idx);
			}

			this.legend.idx = this.uplot.activeIdxs[0];
		}

		if (this.showLegend && this.legend.live) {
			for (let sidx = 0; sidx < this.uplot.series.length; sidx++) {
				if (sidx > 0 || this.uplot.mode == 1 && !this.multiValLegend) {
					this.setLegendValues(sidx, this.uplot.activeIdxs[sidx]);
				}
			}

			this.syncLegend();
		}

		this.uplot.shouldSetLegend = false;

		_fire !== false && this.uplot.fire("setLegend");
	}

	setLegendValues(sidx, idx) {
		let s = this.uplot.series[sidx];
		let src = sidx == 0 && this.uplot.xScaleDistr == 2 ? this.uplot.data0 : this.uplot.data[sidx];
		let val;

		if (this.multiValLegend) {
			val = s.values(this.uplot, sidx, idx) ?? this.NULL_LEGEND_VALUES;
		} else {
			val = s.value(this.uplot, idx == null ? null : src[idx], sidx, idx);
			val = val == null ? this.NULL_LEGEND_VALUES : {_: val};
		}

		this.legend.values[sidx] = val;
	}

	syncLegend() {
		if (this.showLegend && this.legend.live) {
			for (let i = this.uplot.mode == 2 ? 1 : 0; i < this.uplot.series.length; i++) {
				if (i == 0 && this.multiValLegend) continue;

				let vals = this.legend.values[i];

				let j = 0;
				for (let k in vals) {
					if (this.legendCells[i] && this.legendCells[i][j]) {
						this.legendCells[i][j].firstChild.nodeValue = vals[k];
					}
					j++;
				}
			}
		}
	}

	updateSeriesLegend(i, s) {
		if (!this.showLegend) return;
		
		if (s.show) {
			remClass(this.legendRows[i], OFF);
		} else {
			addClass(this.legendRows[i], OFF);
		}
	}

	setSeriesOpacity(i, value) {
		if (this.showLegend && this.legendRows[i]) {
			this.legendRows[i].style.opacity = value;
		}
	}

	onMouse(ev, targ, fn, onlyTarg = true) {
		const targListeners = this.mouseListeners.get(targ) || {};
		const listener = this.uplot.cursor.bind[ev](this.uplot, targ, fn, onlyTarg);

		if (listener) {
			on(ev, targ, targListeners[ev] = listener);
			this.mouseListeners.set(targ, targListeners);
		}
	}

	offMouse(ev, targ, fn) {
		const targListeners = this.mouseListeners.get(targ) || {};

		for (let k in targListeners) {
			if (ev == null || k == ev) {
				off(k, targ, targListeners[k]);
				delete targListeners[k];
			}
		}

		if (ev == null) {
			this.mouseListeners.delete(targ);
		}
	}

	destroy() {
		// Clean up event listeners
		for (let [targ, listeners] of this.mouseListeners) {
			this.offMouse(null, targ);
		}
		this.mouseListeners.clear();
		
		// Clean up DOM elements
		if (this.legendTable) {
			this.legendTable.remove();
		}
		
		// Reset state
		this.legendRows = [];
		this.legendCells = [];
		this.legend = null;
	}
}

/**
 * Series Manager - handles series initialization, configuration, data processing, and rendering coordination
 */


class SeriesManager {
	constructor(uplot, scaleManager) {
		try {
			validateRequired(uplot, 'uplot', 'SeriesManager', 'constructor');
			validateRequired(scaleManager, 'scaleManager', 'SeriesManager', 'constructor');
			
			this.uplot = uplot;
			this.scaleManager = scaleManager;
			this.series = [];
			this.mode = uplot.mode || 1;
			
			// Path generators
			this.linearPath = FEAT_PATHS ? linear() : null;
			this.pointsPath = FEAT_POINTS ? points() : null;
			
			// Time formatting functions (will be set during initialization)
			this._tzDate = null;
			this._fmtDate = null;
			this._timeSeriesVal = null;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize series from options
	 */
	initSeries(opts, data) {
		return withErrorBoundary('SeriesManager', 'initSeries', function(opts, data) {
			validateRequired(opts, 'opts', 'SeriesManager', 'initSeries');
			
			const { series: seriesOpts = [], ms = 1e-3 } = opts;
			
			if (!Array.isArray(seriesOpts)) {
				throw new UPlotError(
					'Series options must be an array',
					'SeriesManager',
					{ method: 'initSeries', seriesOptsType: typeof seriesOpts, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			// Set up time formatting functions
			this._tzDate = (opts.tzDate || (ts => new Date(Math.round(ts / ms))));
			this._fmtDate = (opts.fmtDate || ((ts) => ts ? new Date(ts).toISOString() : ''));
			this._timeSeriesVal = timeSeriesVal(this._tzDate, timeSeriesStamp('', this._fmtDate));
			
			// Initialize series array based on mode
			try {
				if (this.mode == 1) {
					// Ensure we have at least x and y series
					const defaultSeries = seriesOpts.length ? seriesOpts : [{}, {}];
					this.series = this.setDefaults(defaultSeries, xSeriesOpts, ySeriesOpts, false);
				} else {
					this.series = this.setDefaults2(seriesOpts.length ? seriesOpts : [null], xySeriesOpts);
				}
			} catch (error) {
				throw new UPlotError(
					`Error setting series defaults: ${error.message}`,
					'SeriesManager',
					{ method: 'initSeries', mode: this.mode, type: ERROR_TYPES.INITIALIZATION },
					error
				);
			}
			
			// Process each series
			this.series.forEach((s, i) => {
				safeExecute('SeriesManager', `processSeriesConfig[${i}]`, () => {
					this.processSeriesConfig(s, i);
				});
			});
			
			// Set reference on uplot instance
			this.uplot.series = this.series;
			
			return this.series;
		}).call(this, opts, data);
	}

	/**
	 * Set defaults for series configuration (mode 1)
	 */
	setDefaults(seriesArray, xOpts, yOpts, initY) {
		let d2 = initY ? [seriesArray[0], seriesArray[1]].concat(seriesArray.slice(2)) : [seriesArray[0]].concat(seriesArray.slice(1));
		return d2.map((o, i) => this.setDefault(o, i, xOpts, yOpts));
	}

	/**
	 * Set defaults for series configuration (mode 2)
	 */
	setDefaults2(seriesArray, xyOpts) {
		return seriesArray.map((o, i) => i == 0 ? {} : assign({}, xyOpts, o));
	}

	/**
	 * Set default values for a single series
	 */
	setDefault(o, i, xOpts, yOpts) {
		return assign({}, (i == 0 ? xOpts : yOpts), o);
	}

	/**
	 * Process series configuration
	 */
	processSeriesConfig(s, i) {
		const { mode, _tzDate, _fmtDate, _timeSeriesVal } = this;
		const { focus, cursor } = this.uplot;
		const pxAlign = +ifNull(this.uplot.opts?.pxAlign, 1);
		
		// Configure value and label functions for time/numeric series
		if (mode == 1 || i > 0) {
			let isTime = mode == 1 && this.scaleManager.scales[s.scale]?.time;
			
			let sv = s.value;
			s.value = isTime ? 
				(isStr(sv) ? timeSeriesVal(_tzDate, timeSeriesStamp(sv, _fmtDate)) : sv || _timeSeriesVal) : 
				sv || numSeriesVal;
			s.label = s.label || (isTime ? timeSeriesLabel : numSeriesLabel);
		}
		
		// Configure rendering properties for non-x-axis series
		const cursorOnePt = focus?.prox >= 0 && cursor?.points?.one;
		if (cursorOnePt || i > 0) {
			s.width = s.width == null ? 1 : s.width;
			s.paths = s.paths || this.linearPath || retNull;
			s.fillTo = fnOrSelf(s.fillTo || seriesFillTo);
			s.pxAlign = +ifNull(s.pxAlign, pxAlign);
			s.pxRound = pxRoundGen(s.pxAlign);
			
			s.stroke = fnOrSelf(s.stroke || null);
			s.fill = fnOrSelf(s.fill || null);
			s._stroke = s._fill = s._paths = s._focus = null;
			
			// Configure points
			let _ptDia = ptDia(max(1, s.width), 1);
			let points = s.points = assign({}, {
				size: _ptDia,
				width: max(1, _ptDia * 0.2),
				stroke: s.stroke,
				space: _ptDia * 2,
				paths: this.pointsPath,
				_stroke: null,
				_fill: null,
			}, s.points);
			
			points.show = fnOrSelf(points.show);
			points.filter = fnOrSelf(points.filter);
			points.fill = fnOrSelf(points.fill);
			points.stroke = fnOrSelf(points.stroke);
			points.paths = fnOrSelf(points.paths);
			points.pxAlign = s.pxAlign;
		}
	}

	/**
	 * Add a new series
	 */
	addSeries(opts, si) {
		try {
			validateRequired(opts, 'opts', 'SeriesManager', 'addSeries');
			
			si = si == null ? this.series.length : si;
			
			if (typeof si !== 'number' || si < 0) {
				throw new UPlotError(
					`Invalid series index ${si}. Must be a non-negative number`,
					'SeriesManager',
					{ method: 'addSeries', seriesIndex: si, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (si > this.series.length) {
				throw new UPlotError(
					`Series index ${si} is out of bounds. Maximum allowed is ${this.series.length}`,
					'SeriesManager',
					{ method: 'addSeries', seriesIndex: si, maxIndex: this.series.length, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			// Apply defaults based on mode
			opts = this.mode == 1 ? 
				this.setDefault(opts, si, xSeriesOpts, ySeriesOpts) : 
				this.setDefault(opts, si, {}, xySeriesOpts);
			
			// Insert series
			this.series.splice(si, 0, opts);
			
			// Process configuration
			this.processSeriesConfig(this.series[si], si);
			
			// Fire event
			if (typeof this.uplot.fire === 'function') {
				this.uplot.fire("addSeries", si);
			}
			
			return si;
		} catch (error) {
			errorReporter.reportError(new UPlotError(
				`Error adding series at index ${si}: ${error.message}`,
				'SeriesManager',
				{ method: 'addSeries', seriesIndex: si, type: ERROR_TYPES.DATA_PROCESSING },
				error
			));
			throw error;
		}
	}

	/**
	 * Remove a series
	 */
	delSeries(i) {
		return withErrorBoundary('SeriesManager', 'delSeries', function(i) {
			validateRequired(i, 'i', 'SeriesManager', 'delSeries');
			validateType(i, 'number', 'i', 'SeriesManager', 'delSeries');
			
			if (i < 0 || i >= this.series.length) {
				throw new UPlotError(
					`Invalid series index ${i}. Must be between 0 and ${this.series.length - 1}`,
					'SeriesManager',
					{ method: 'delSeries', seriesIndex: i, seriesLength: this.series.length, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (i === 0 && this.mode === 1) {
				throw new UPlotError(
					'Cannot delete the x-axis series (index 0) in mode 1',
					'SeriesManager',
					{ method: 'delSeries', seriesIndex: i, mode: this.mode, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			try {
				this.series.splice(i, 1);
				
				// Fire event
				if (typeof this.uplot.fire === 'function') {
					this.uplot.fire("delSeries", i);
				}
			} catch (error) {
				throw new UPlotError(
					`Error removing series at index ${i}: ${error.message}`,
					'SeriesManager',
					{ method: 'delSeries', seriesIndex: i, type: ERROR_TYPES.DATA_PROCESSING },
					error
				);
			}
			
			return i;
		}).call(this, i);
	}

	/**
	 * Update series configuration
	 */
	setSeries(i, opts, _fire, _pub) {
		if (i == null || !this.series[i]) return;
		
		let s = this.series[i];
		
		// Handle focus changes
		if (opts.focus != null) {
			this.setSeriesFocus(i, opts.focus);
		}
		
		// Handle show/hide changes
		if (opts.show != null) {
			this.setSeriesVisibility(i, opts.show);
		}
		
		// Handle alpha changes
		if (opts.alpha != null) {
			this.setSeriesAlpha(i, opts.alpha);
		}
		
		// Apply other options
		assign(s, opts);
		
		// Fire events
		_fire !== false && this.uplot.fire("setSeries", i, opts);
		_pub && this.uplot.pubSync && this.uplot.pubSync("setSeries", this.uplot, i, opts);
	}

	/**
	 * Set series focus state
	 */
	setSeriesFocus(i, focused) {
		if (i == null) {
			// Clear all focus
			this.series.forEach((s, idx) => {
				if (idx > 0) {
					s._focus = null;
				}
			});
		} else if (this.series[i]) {
			this.series[i]._focus = focused;
		}
	}

	/**
	 * Set series visibility
	 */
	setSeriesVisibility(i, show) {
		if (this.series[i]) {
			this.series[i].show = show;
		}
	}

	/**
	 * Set series alpha
	 */
	setSeriesAlpha(i, alpha) {
		if (this.series[i]) {
			this.series[i].alpha = alpha;
		}
	}

	/**
	 * Reset series paths (called when scales change)
	 */
	resetYSeries(minMax) {
		try {
			this.series.forEach((s, i) => {
				if (i > 0) {
					s._paths = null;
					
					if (minMax || s.min == null) {
						s.min = inf;
						s.max = -inf;
					}
				}
			});
		} catch (error) {
			errorReporter.reportError(new UPlotError(
				`Error resetting Y series: ${error.message}`,
				'SeriesManager',
				{ method: 'resetYSeries', type: ERROR_TYPES.DATA_PROCESSING },
				error
			));
			throw error;
		}
	}

	/**
	 * Get outer indices for data rendering optimization
	 */
	getOuterIdxs(ydata, i0, i1, dataLen) {
		let _i0 = clamp(i0 - 1, 0, dataLen - 1);
		let _i1 = clamp(i1 + 1, 0, dataLen - 1);
		
		// Find first non-null value before i0
		while (ydata[_i0] == null && _i0 > 0) {
			_i0--;
		}
		
		// Find first non-null value after i1
		while (ydata[_i1] == null && _i1 < dataLen - 1) {
			_i1++;
		}
		
		return [_i0, _i1];
	}

	/**
	 * Cache stroke and fill styles for a series
	 */
	cacheStrokeFill(si, _points) {
		let s = _points ? this.series[si].points : this.series[si];
		
		s._stroke = s.stroke(this.uplot, si);
		s._fill = s.fill(this.uplot, si);
	}

	/**
	 * Generate paths for a series
	 */
	generateSeriesPaths(si, data, i0, i1, dataLen) {
		let s = this.series[si];
		
		if (!s || si === 0) return null;
		
		let _idxs = this.mode == 2 ? 
			[0, data[si][0].length - 1] : 
			this.getOuterIdxs(data[si], i0, i1, dataLen);
		
		return s.paths(this.uplot, si, _idxs[0], _idxs[1]);
	}

	/**
	 * Check if any series has focus
	 */
	hasFocusedSeries() {
		return this.series.some(s => s._focus);
	}

	/**
	 * Get series by index
	 */
	getSeries(i) {
		return this.series[i];
	}

	/**
	 * Get all series
	 */
	getAllSeries() {
		return this.series;
	}

	/**
	 * Get series count
	 */
	getSeriesCount() {
		return this.series.length;
	}

	/**
	 * Check if series is visible
	 */
	isSeriesVisible(i) {
		return this.series[i]?.show !== false;
	}

	/**
	 * Get visible series indices
	 */
	getVisibleSeriesIndices() {
		return this.series.map((s, i) => s.show !== false ? i : null).filter(i => i !== null);
	}

	/**
	 * Update series paths when scales change
	 */
	updateSeriesForScaleChange(changedScales) {
		this.series.forEach((s, i) => {
			if (i > 0) {
				if (this.mode == 2) {
					if (changedScales.y) {
						s._paths = null;
					}
				} else {
					if (changedScales[s.scale]) {
						s._paths = null;
					}
				}
			}
		});
	}

	/**
	 * Prepare series for drawing
	 */
	prepareSeriesForDraw(data, i0, i1, dataLen) {
		const results = [];
		
		this.series.forEach((s, i) => {
			if (i > 0 && s.show) {
				// Cache stroke and fill
				this.cacheStrokeFill(i, false);
				this.cacheStrokeFill(i, true);
				
				// Generate paths if needed
				if (s._paths == null) {
					s._paths = this.generateSeriesPaths(i, data, i0, i1, dataLen);
				}
				
				results.push({
					index: i,
					series: s,
					paths: s._paths,
					points: s.points
				});
			}
		});
		
		return results;
	}

	/**
	 * Get drawing information for a series
	 */
	getSeriesDrawInfo(si, _points) {
		let s = _points ? this.series[si].points : this.series[si];
		
		if (!s || !s._paths) return null;
		
		const { 
			stroke: strokeStyle = s._stroke,
			fill: fillStyle = s._fill,
			width = s.width,
			flags
		} = s._paths;
		
		return {
			strokeStyle,
			fillStyle,
			width: roundDec(width * (this.uplot.pxRatio || 1), 3),
			flags,
			pxAlign: s.pxAlign,
			paths: s._paths
		};
	}
}

// dim is logical (getClientBoundingRect) pixels, not canvas pixels
function findIncr(minVal, maxVal, incrs, dim, minSpace) {
	let intDigits = max(numIntDigits(minVal), numIntDigits(maxVal));

	let delta = maxVal - minVal;

	let incrIdx = closestIdx((minSpace / dim) * delta, incrs);

	do {
		let foundIncr = incrs[incrIdx];
		let foundSpace = dim * foundIncr / delta;

		if (foundSpace >= minSpace && intDigits + (foundIncr < 5 ? fixedDec.get(foundIncr) : 0) <= 17)
			return [foundIncr, foundSpace];
	} while (++incrIdx < incrs.length);

	return [0, 0];
}

function pxRatioFont(font, pxRatio) {
	let fontSize, fontSizeCss;
	font = font.replace(/(\d+)px/, (m, p1) => (fontSize = round((fontSizeCss = +p1) * pxRatio)) + 'px');
	return [font, fontSize, fontSizeCss];
}

function syncFontSize(axis, pxRatio) {
	if (axis.show) {
		[axis.font, axis.labelFont].forEach(f => {
			let size = roundDec(f[2] * pxRatio, 1);
			f[0] = f[0].replace(/[0-9.]+px/, size + 'px');
			f[1] = size;
		});
	}
}

class AxisManager {
	constructor(uplot, scaleManager) {
		try {
			validateRequired(uplot, 'uplot', 'AxisManager', 'constructor');
			validateRequired(scaleManager, 'scaleManager', 'AxisManager', 'constructor');
			
			this.uplot = uplot;
			this.scaleManager = scaleManager;
			this.axes = uplot.axes;
			this.scales = uplot.scales;
			this.series = uplot.series;
			this.sidesWithAxes = [false, false, false, false];
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	initAxes(opts) {
		return withErrorBoundary('AxisManager', 'initAxes', function(opts) {
			validateRequired(opts, 'opts', 'AxisManager', 'initAxes');
			
			const { uplot } = this;
			const { mode, pxRatio, wrap } = uplot;
			const series = uplot.series; // Get series from uplot instance
			const { scales } = this;
			
			if (!series || !Array.isArray(series) || series.length === 0) {
				throw new UPlotError(
					'No series available for axis initialization',
					'AxisManager',
					{ method: 'initAxes', seriesLength: series?.length, type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			// Get scale key for x-axis
			const xScaleKey = mode == 2 ? 
				(series[1]?.facets?.[0]?.scale || 'x') : 
				(series[0]?.scale || 'x');
			
			// Get axes configuration from uplot instance
			const axesConfig = uplot.axesConfig || [];
			
			if (!Array.isArray(axesConfig)) {
				throw new UPlotError(
					'Axes array not properly initialized',
					'AxisManager',
					{ method: 'initAxes', axesType: typeof axesConfig, type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			// Store the axes configuration
			this.axes = axesConfig;
			
			this.axes.forEach((axis, i) => {
				safeExecute('AxisManager', `initAxis[${i}]`, () => {
					this.initAxis(axis, i, xScaleKey, pxRatio, wrap);
				});
			});
		}).call(this, opts);
	}

	initAxis(axis, i, xScaleKey, pxRatio, wrap) {
		const { uplot, scales, series } = this;
		const { ms, _timeAxisSplits, _timeAxisVals, _fmtDate, _tzDate } = uplot;
		
		axis._show = axis.show;

		if (axis.show) {
			let isVt = axis.side % 2;

			let sc = scales[axis.scale];

			// this can occur if all series specify non-default scales
			if (sc == null) {
				axis.scale = isVt ? series[1].scale : xScaleKey;
				sc = scales[axis.scale];
			}

			// also set defaults for incrs & values based on axis distr
			let isTime = sc.time;

			axis.size   = fnOrSelf(axis.size);
			axis.space  = fnOrSelf(axis.space);
			axis.rotate = fnOrSelf(axis.rotate);

			if (isArr(axis.incrs)) {
				axis.incrs.forEach(incr => {
					!fixedDec.has(incr) && fixedDec.set(incr, guessDec(incr));
				});
			}

			axis.incrs  = fnOrSelf(axis.incrs  || (          sc.distr == 2 ? wholeIncrs : (isTime ? (ms == 1 ? timeIncrsMs : timeIncrsS) : numIncrs)));
			axis.splits = fnOrSelf(axis.splits || (isTime && sc.distr == 1 ? _timeAxisSplits : sc.distr == 3 ? logAxisSplits : sc.distr == 4 ? asinhAxisSplits : numAxisSplits));

			axis.stroke        = fnOrSelf(axis.stroke);
			axis.grid.stroke   = fnOrSelf(axis.grid.stroke);
			axis.ticks.stroke  = fnOrSelf(axis.ticks.stroke);
			axis.border.stroke = fnOrSelf(axis.border.stroke);

			let av = axis.values;

			axis.values = (
				// static array of tick values
				isArr(av) && !isArr(av[0]) ? fnOrSelf(av) :
				// temporal
				isTime ? (
					// config array of fmtDate string tpls
					isArr(av) ?
						timeAxisVals(_tzDate, timeAxisStamps(av, _fmtDate)) :
					// fmtDate string tpl
					isStr(av) ?
						timeAxisVal(_tzDate, av) :
					av || _timeAxisVals
				) : av || numAxisVals
			);

			axis.filter = fnOrSelf(axis.filter || (          sc.distr >= 3 && sc.log == 10 ? log10AxisValsFilt : sc.distr == 3 && sc.log == 2 ? log2AxisValsFilt : retArg1));

			axis.font      = pxRatioFont(axis.font, pxRatio);
			axis.labelFont = pxRatioFont(axis.labelFont, pxRatio);

			axis._size   = axis.size(uplot, null, i, 0);

			axis._space  =
			axis._rotate =
			axis._incrs  =
			axis._found  =	// foundIncrSpace
			axis._splits =
			axis._values = null;

			if (axis._size > 0) {
				this.sidesWithAxes[i] = true;
				axis._el = placeDiv(AXIS, wrap);
			}
		}
	}

	getIncrSpace(axisIdx, min, max, fullDim) {
		return withErrorBoundary('AxisManager', 'getIncrSpace', function(axisIdx, min, max, fullDim) {
			validateRequired(axisIdx, 'axisIdx', 'AxisManager', 'getIncrSpace');
			validateType(axisIdx, 'number', 'axisIdx', 'AxisManager', 'getIncrSpace');
			validateRequired(min, 'min', 'AxisManager', 'getIncrSpace');
			validateRequired(max, 'max', 'AxisManager', 'getIncrSpace');
			validateRequired(fullDim, 'fullDim', 'AxisManager', 'getIncrSpace');
			validateType(fullDim, 'number', 'fullDim', 'AxisManager', 'getIncrSpace');
			
			if (axisIdx < 0 || axisIdx >= this.axes.length) {
				throw new UPlotError(
					`Invalid axis index ${axisIdx}. Must be between 0 and ${this.axes.length - 1}`,
					'AxisManager',
					{ method: 'getIncrSpace', axisIdx, axesLength: this.axes.length, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			const { uplot } = this;
			let axis = this.axes[axisIdx];
			
			if (!axis) {
				throw new UPlotError(
					`Axis at index ${axisIdx} is null or undefined`,
					'AxisManager',
					{ method: 'getIncrSpace', axisIdx, type: ERROR_TYPES.VALIDATION }
				);
			}

			let incrSpace;

			if (fullDim <= 0) {
				incrSpace = [0, 0];
			} else {
				try {
					let minSpace = axis._space = axis.space(uplot, axisIdx, min, max, fullDim);
					let incrs = axis._incrs = axis.incrs(uplot, axisIdx, min, max, fullDim, minSpace);
					incrSpace = findIncr(min, max, incrs, fullDim, minSpace);
				} catch (error) {
					throw new UPlotError(
						`Error calculating increment space: ${error.message}`,
						'AxisManager',
						{ method: 'getIncrSpace', axisIdx, min, max, fullDim, type: ERROR_TYPES.LAYOUT_CALCULATION },
						error
					);
				}
			}

			return (axis._found = incrSpace);
		}).call(this, axisIdx, min, max, fullDim);
	}

	axesCalc(cycleNum, plotWidCss, plotHgtCss, data0, resetYSeries) {
		return withErrorBoundary('AxisManager', 'axesCalc', function(cycleNum, plotWidCss, plotHgtCss, data0, resetYSeries) {
			validateRequired(cycleNum, 'cycleNum', 'AxisManager', 'axesCalc');
			validateRequired(plotWidCss, 'plotWidCss', 'AxisManager', 'axesCalc');
			validateRequired(plotHgtCss, 'plotHgtCss', 'AxisManager', 'axesCalc');
			validateType(plotWidCss, 'number', 'plotWidCss', 'AxisManager', 'axesCalc');
			validateType(plotHgtCss, 'number', 'plotHgtCss', 'AxisManager', 'axesCalc');
			
			const { uplot, axes, scales } = this;
			
			if (!axes || !Array.isArray(axes)) {
				throw new UPlotError(
					'Axes not properly initialized',
					'AxisManager',
					{ method: 'axesCalc', axesType: typeof axes, type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			let converged = true;

			axes.forEach((axis, i) => {
				safeExecute('AxisManager', `axesCalc[${i}]`, () => {
					if (!axis.show) return;

					let scale = scales[axis.scale];
					
					if (!scale) {
						throw new UPlotError(
							`Scale '${axis.scale}' not found for axis ${i}`,
							'AxisManager',
							{ method: 'axesCalc', axisIndex: i, scaleKey: axis.scale, type: ERROR_TYPES.VALIDATION }
						);
					}

					if (scale.min == null) {
						if (axis._show) {
							converged = false;
							axis._show = false;
							if (typeof resetYSeries === 'function') {
								resetYSeries(false);
							}
						}
						return;
					} else {
						if (!axis._show) {
							converged = false;
							axis._show = true;
							if (typeof resetYSeries === 'function') {
								resetYSeries(false);
							}
						}
					}

					let side = axis.side;
					let ori = side % 2;
					let {min, max} = scale;

					let [_incr, _space] = this.getIncrSpace(i, min, max, ori == 0 ? plotWidCss : plotHgtCss);

					if (_space == 0) return;

					// if we're using index positions, force first tick to match passed index
					let forceMin = scale.distr == 2;

					try {
						let _splits = axis._splits = axis.splits(uplot, i, min, max, _incr, _space, forceMin);

						// tick labels
						let splits = scale.distr == 2 ? _splits.map(i => data0[i]) : _splits;
						let incr = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;

						let values = axis._values = axis.values(uplot, axis.filter(uplot, splits, i, _space, incr), i, _space, incr);

						// rotating of labels only supported on bottom x axis
						axis._rotate = side == 2 ? axis.rotate(uplot, values, i, _space) : 0;

						let oldSize = axis._size;
						axis._size = ceil(axis.size(uplot, values, i, cycleNum));

						if (oldSize != null && axis._size != oldSize) {
							converged = false;
						}
					} catch (error) {
						throw new UPlotError(
							`Error calculating axis ${i}: ${error.message}`,
							'AxisManager',
							{ method: 'axesCalc', axisIndex: i, type: ERROR_TYPES.LAYOUT_CALCULATION },
							error
						);
					}
				});
			});

			return converged;
		}).call(this, cycleNum, plotWidCss, plotHgtCss, data0, resetYSeries);
	}

	calcAxesRects(plotLftCss, plotTopCss, plotWidCss, plotHgtCss) {
		const { axes } = this;
		
		// will accum +
		let off1 = plotLftCss + plotWidCss;
		let off2 = plotTopCss + plotHgtCss;
		// will accum -
		let off3 = plotLftCss;
		let off0 = plotTopCss;

		function incrOffset(side, size) {
			switch (side) {
				case 1: off1 += size; return off1 - size;
				case 2: off2 += size; return off2 - size;
				case 3: off3 -= size; return off3 + size;
				case 0: off0 -= size; return off0 + size;
			}
		}

		axes.forEach((axis, i) => {
			if (axis.show && axis._show) {
				let side = axis.side;

				axis._pos = incrOffset(side, axis._size);

				if (axis.label != null)
					axis._lpos = incrOffset(side, axis.labelSize);
			}
		});
	}

	drawOrthoLines(ctx, offs, filts, ori, side, pos0, len, width, stroke, dash, cap, pxAlign, setCtxStyle) {
		let offset = (width % 2) / 2;

		pxAlign == 1 && ctx.translate(offset, offset);

		setCtxStyle(stroke, width, dash, cap, stroke);

		ctx.beginPath();

		let x0, y0, x1, y1, pos1 = pos0 + (side == 0 || side == 3 ? -len : len);

		if (ori == 0) {
			y0 = pos0;
			y1 = pos1;
		}
		else {
			x0 = pos0;
			x1 = pos1;
		}

		for (let i = 0; i < offs.length; i++) {
			if (filts[i] != null) {
				if (ori == 0)
					x0 = x1 = offs[i];
				else
					y0 = y1 = offs[i];

				ctx.moveTo(x0, y0);
				ctx.lineTo(x1, y1);
			}
		}

		ctx.stroke();

		pxAlign == 1 && ctx.translate(-offset, -offset);
	}

	drawAxesGrid(ctx, data0, plotLft, plotTop, plotWid, plotHgt, pxRatio, pxAlign, pxRound, getPos, setFontStyle, setCtxStyle, fire) {
		const { uplot, axes, scales } = this;
		
		for (let i = 0; i < axes.length; i++) {
			let axis = axes[i];

			if (!axis.show || !axis._show)
				continue;

			let side = axis.side;
			let ori = side % 2;

			let x, y;

			let fillStyle = axis.stroke(uplot, i);

			let shiftDir = side == 0 || side == 3 ? -1 : 1;

			let [_incr, _space] = axis._found;

			// axis label
			if (axis.label != null) {
				let shiftAmt = axis.labelGap * shiftDir;
				let baseLpos = round((axis._lpos + shiftAmt) * pxRatio);

				setFontStyle(axis.labelFont[0], fillStyle, "center", side == 2 ? TOP : BOTTOM);

				ctx.save();

				if (ori == 1) {
					x = y = 0;

					ctx.translate(
						baseLpos,
						round(plotTop + plotHgt / 2),
					);
					ctx.rotate((side == 3 ? -PI : PI) / 2);

				}
				else {
					x = round(plotLft + plotWid / 2);
					y = baseLpos;
				}

				let _label = isFn(axis.label) ? axis.label(uplot, i, _incr, _space) : axis.label;

				ctx.fillText(_label, x, y);

				ctx.restore();
			}

			if (_space == 0)
				continue;

			let scale = scales[axis.scale];

			let plotDim = ori == 0 ? plotWid : plotHgt;
			let plotOff = ori == 0 ? plotLft : plotTop;

			let _splits = axis._splits;

			// tick labels
			// BOO this assumes a specific data/series
			let splits = scale.distr == 2 ? _splits.map(i => data0[i]) : _splits;
			let incr   = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;

			let ticks = axis.ticks;
			let border = axis.border;
			let _tickSize = ticks.show ? ticks.size : 0;
			let tickSize = round(_tickSize * pxRatio);
			let axisGap = round((axis.alignTo == 2 ? axis._size - _tickSize - axis.gap : axis.gap) * pxRatio);

			// rotating of labels only supported on bottom x axis
			let angle = axis._rotate * -PI/180;

			let basePos  = pxRound(axis._pos * pxRatio);
			let shiftAmt = (tickSize + axisGap) * shiftDir;
			let finalPos = basePos + shiftAmt;
			    y        = ori == 0 ? finalPos : 0;
			    x        = ori == 1 ? finalPos : 0;

			let font         = axis.font[0];
			let textAlign    = axis.align == 1 ? LEFT :
			                   axis.align == 2 ? RIGHT :
			                   angle > 0 ? LEFT :
			                   angle < 0 ? RIGHT :
			                   ori == 0 ? "center" : side == 3 ? RIGHT : LEFT;
			let textBaseline = angle ||
			                   ori == 1 ? "middle" : side == 2 ? TOP   : BOTTOM;

			setFontStyle(font, fillStyle, textAlign, textBaseline);

			let lineHeight = axis.font[1] * axis.lineGap;

			let canOffs = _splits.map(val => pxRound(getPos(val, scale, plotDim, plotOff)));

			let _values = axis._values;

			for (let i = 0; i < _values.length; i++) {
				let val = _values[i];

				if (val != null) {
					if (ori == 0)
						x = canOffs[i];
					else
						y = canOffs[i];

					val = "" + val;

					let _parts = val.indexOf("\n") == -1 ? [val] : val.split(/\n/gm);

					for (let j = 0; j < _parts.length; j++) {
						let text = _parts[j];

						if (angle) {
							ctx.save();
							ctx.translate(x, y + j * lineHeight);
							ctx.rotate(angle);
							ctx.fillText(text, 0, 0);
							ctx.restore();
						}
						else
							ctx.fillText(text, x, y + j * lineHeight);
					}
				}
			}

			// ticks
			if (ticks.show) {
				this.drawOrthoLines(
					ctx,
					canOffs,
					ticks.filter(uplot, splits, i, _space, incr),
					ori,
					side,
					basePos,
					tickSize,
					roundDec(ticks.width * pxRatio, 3),
					ticks.stroke(uplot, i),
					ticks.dash,
					ticks.cap,
					pxAlign,
					setCtxStyle
				);
			}

			// grid
			let grid = axis.grid;

			if (grid.show) {
				this.drawOrthoLines(
					ctx,
					canOffs,
					grid.filter(uplot, splits, i, _space, incr),
					ori,
					ori == 0 ? 2 : 1,
					ori == 0 ? plotTop : plotLft,
					ori == 0 ? plotHgt : plotWid,
					roundDec(grid.width * pxRatio, 3),
					grid.stroke(uplot, i),
					grid.dash,
					grid.cap,
					pxAlign,
					setCtxStyle
				);
			}

			if (border.show) {
				this.drawOrthoLines(
					ctx,
					[basePos],
					[1],
					ori == 0 ? 1 : 0,
					ori == 0 ? 1 : 2,
					ori == 1 ? plotTop : plotLft,
					ori == 1 ? plotHgt : plotWid,
					roundDec(border.width * pxRatio, 3),
					border.stroke(uplot, i),
					border.dash,
					border.cap,
					pxAlign,
					setCtxStyle
				);
			}
		}

		fire("drawAxes");
	}

	syncFontSizes(pxRatio) {
		this.axes.forEach(axis => syncFontSize(axis, pxRatio));
	}
}

/**
 * Renderer class handles all canvas drawing operations and rendering optimization
 */
class Renderer {
	constructor(uplot, layoutManager) {
		try {
			validateRequired(uplot, 'uplot', 'Renderer', 'constructor');
			validateRequired(layoutManager, 'layoutManager', 'Renderer', 'constructor');
			
			if (!uplot.ctx) {
				throw new UPlotError(
					'uPlot instance missing canvas context',
					'Renderer',
					{ method: 'constructor', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			this.u = uplot;
			this.layoutManager = layoutManager;
			this.ctx = uplot.ctx;
			this.can = uplot.can;
			
			// Canvas context style cache for optimization
			this.ctxStroke = null;
			this.ctxFill = null;
			this.ctxWidth = null;
			this.ctxDash = null;
			this.ctxJoin = null;
			this.ctxCap = null;
			this.ctxFont = null;
			this.ctxAlign = null;
			this.ctxBaseline = null;
			this.ctxAlpha = 1;
			
			// Drawing order configuration
			this.drawOrderMap = {
				axes: () => this.drawAxesGrid(),
				series: () => this.drawSeries(),
			};
			
			const drawOrderOpts = uplot.opts?.drawOrder || ["axes", "series"];
			if (!Array.isArray(drawOrderOpts)) {
				throw new UPlotError(
					'drawOrder option must be an array',
					'Renderer',
					{ method: 'constructor', drawOrderType: typeof drawOrderOpts, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			this.drawOrder = drawOrderOpts.map(key => {
				if (!this.drawOrderMap[key]) {
					throw new UPlotError(
						`Invalid draw order key: ${key}. Valid keys are: ${Object.keys(this.drawOrderMap).join(', ')}`,
						'Renderer',
						{ method: 'constructor', invalidKey: key, type: ERROR_TYPES.VALIDATION }
					);
				}
				return this.drawOrderMap[key];
			});
			
			// Constants for band clipping
			this.CLIP_FILL_STROKE = BAND_CLIP_FILL | BAND_CLIP_STROKE;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize canvas with proper dimensions and pixel ratio
	 */
	initCanvas(opts) {
		return withErrorBoundary('Renderer', 'initCanvas', function(opts) {
			const { pxRatio } = this.u;
			const { fullWidCss, fullHgtCss } = this.layoutManager;
			
			if (typeof pxRatio !== 'number' || pxRatio <= 0) {
				throw new UPlotError(
					`Invalid pixel ratio: ${pxRatio}. Must be a positive number`,
					'Renderer',
					{ method: 'initCanvas', pxRatio, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (typeof fullWidCss !== 'number' || typeof fullHgtCss !== 'number') {
				throw new UPlotError(
					`Invalid canvas dimensions: width=${fullWidCss}, height=${fullHgtCss}. Both must be numbers`,
					'Renderer',
					{ method: 'initCanvas', fullWidCss, fullHgtCss, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (fullWidCss <= 0 || fullHgtCss <= 0) {
				throw new UPlotError(
					`Invalid canvas dimensions: width=${fullWidCss}, height=${fullHgtCss}. Both must be positive`,
					'Renderer',
					{ method: 'initCanvas', fullWidCss, fullHgtCss, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			try {
				// Set canvas dimensions
				this.can.width = round(fullWidCss * pxRatio);
				this.can.height = round(fullHgtCss * pxRatio);
				
				// Set CSS dimensions
				this.can.style.width = fullWidCss + 'px';
				this.can.style.height = fullHgtCss + 'px';
				
				// Invalidate context style cache
				this.invalidateStyleCache();
			} catch (error) {
				throw new UPlotError(
					`Error initializing canvas: ${error.message}`,
					'Renderer',
					{ method: 'initCanvas', fullWidCss, fullHgtCss, pxRatio, type: ERROR_TYPES.RENDERING },
					error
				);
			}
		}).call(this, opts);
	}

	/**
	 * Main draw function that orchestrates all rendering
	 */
	draw() {
		return withErrorBoundary('Renderer', 'draw', function() {
			const { fullWidCss, fullHgtCss } = this.layoutManager;
			
			if (fullWidCss > 0 && fullHgtCss > 0) {
				try {
					this.clear();
					
					if (typeof this.u.fire === 'function') {
						this.u.fire("drawClear");
					}
					
					this.drawOrder.forEach((fn, index) => {
						safeExecute('Renderer', `drawOrder[${index}]`, fn);
					});
					
					if (typeof this.u.fire === 'function') {
						this.u.fire("draw");
					}
				} catch (error) {
					throw new UPlotError(
						`Error during rendering: ${error.message}`,
						'Renderer',
						{ method: 'draw', fullWidCss, fullHgtCss, type: ERROR_TYPES.RENDERING },
						error
					);
				}
			}
		}).call(this);
	}

	/**
	 * Clear the entire canvas
	 */
	clear() {
		return withErrorBoundary('Renderer', 'clear', function() {
			if (!this.ctx) {
				throw new UPlotError(
					'Canvas context not available',
					'Renderer',
					{ method: 'clear', type: ERROR_TYPES.RENDERING }
				);
			}
			
			try {
				this.ctx.clearRect(0, 0, this.can.width, this.can.height);
			} catch (error) {
				throw new UPlotError(
					`Error clearing canvas: ${error.message}`,
					'Renderer',
					{ method: 'clear', canvasWidth: this.can.width, canvasHeight: this.can.height, type: ERROR_TYPES.RENDERING },
					error
				);
			}
		}).call(this);
	}

	/**
	 * Draw all series paths and points
	 */
	drawSeries() {
		const { series, data, focus, mode } = this.u;
		const dataLen = data[0]?.length || 0;
		
		if (dataLen > 0) {
			let shouldAlpha = series.some(s => s._focus) && this.ctxAlpha != focus.alpha;

			if (shouldAlpha) {
				this.ctx.globalAlpha = this.ctxAlpha = focus.alpha;
			}

			// First pass: generate paths
			series.forEach((s, i) => {
				if (i > 0 && s.show) {
					this.cacheStrokeFill(i, false); // cache series stroke/fill
					this.cacheStrokeFill(i, true);  // cache points stroke/fill

					if (s._paths == null) {
						let _ctxAlpha = this.ctxAlpha;

						if (this.ctxAlpha != s.alpha) {
							this.ctx.globalAlpha = this.ctxAlpha = s.alpha;
						}

						let _idxs = mode == 2 ? [0, data[i][0].length - 1] : this.getOuterIdxs(data[i]);
						s._paths = s.paths(this.u, i, _idxs[0], _idxs[1]);

						if (this.ctxAlpha != _ctxAlpha) {
							this.ctx.globalAlpha = this.ctxAlpha = _ctxAlpha;
						}
					}
				}
			});

			// Second pass: draw paths and points
			series.forEach((s, i) => {
				if (i > 0 && s.show) {
					let _ctxAlpha = this.ctxAlpha;

					if (this.ctxAlpha != s.alpha) {
						this.ctx.globalAlpha = this.ctxAlpha = s.alpha;
					}

					// Draw series paths
					if (s._paths != null) {
						this.drawPath(i, false);
					}

					// Draw points
					if (s.points) {
						let _gaps = s._paths != null ? s._paths.gaps : null;
						let show = s.points.show(this.u, i, this.u.i0, this.u.i1, _gaps);
						let idxs = s.points.filter(this.u, i, show, _gaps);

						if (show || idxs) {
							s.points._paths = s.points.paths(this.u, i, this.u.i0, this.u.i1, idxs);
							this.drawPath(i, true);
						}
					}

					if (this.ctxAlpha != _ctxAlpha) {
						this.ctx.globalAlpha = this.ctxAlpha = _ctxAlpha;
					}

					this.u.fire("drawSeries", i);
				}
			});

			if (shouldAlpha) {
				this.ctx.globalAlpha = this.ctxAlpha = 1;
			}
		}
	}

	/**
	 * Draw axes grid, ticks, and labels
	 */
	drawAxesGrid() {
		const { axes, scales, data, plotLft, plotTop, plotWid, plotHgt, pxRatio } = this.u;
		const data0 = data[0];
		
		for (let i = 0; i < axes.length; i++) {
			let axis = axes[i];

			if (!axis.show || !axis._show) {
				continue;
			}

			let side = axis.side;
			let ori = side % 2;
			let fillStyle = axis.stroke(this.u, i);
			let shiftDir = side == 0 || side == 3 ? -1 : 1;
			let [_incr, _space] = axis._found;

			// Draw axis label
			if (axis.label != null) {
				this.drawAxisLabel(axis, i, ori, side, fillStyle, shiftDir, _incr, _space);
			}

			if (_space == 0) {
				continue;
			}

			let scale = scales[axis.scale];
			let plotDim = ori == 0 ? plotWid : plotHgt;
			let plotOff = ori == 0 ? plotLft : plotTop;
			let _splits = axis._splits;

			// Prepare tick data
			let splits = scale.distr == 2 ? _splits.map(i => data0[i]) : _splits;
			let incr = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;

			let ticks = axis.ticks;
			let border = axis.border;
			let _tickSize = ticks.show ? ticks.size : 0;
			let tickSize = round(_tickSize * pxRatio);
			let axisGap = round((axis.alignTo == 2 ? axis._size - _tickSize - axis.gap : axis.gap) * pxRatio);

			let basePos = this.u.pxRound(axis._pos * pxRatio);
			let canOffs = _splits.map(val => this.u.pxRound(this.u.getPos(val, scale, plotDim, plotOff)));

			// Draw tick labels
			this.drawTickLabels(axis, i, ori, side, basePos, tickSize, axisGap, shiftDir, canOffs, fillStyle);

			// Draw ticks
			if (ticks.show) {
				this.drawOrthoLines(
					canOffs,
					ticks.filter(this.u, splits, i, _space, incr),
					ori,
					side,
					basePos,
					tickSize,
					roundDec(ticks.width * pxRatio, 3),
					ticks.stroke(this.u, i),
					ticks.dash,
					ticks.cap,
				);
			}

			// Draw grid
			let grid = axis.grid;
			if (grid.show) {
				this.drawOrthoLines(
					canOffs,
					grid.filter(this.u, splits, i, _space, incr),
					ori,
					ori == 0 ? 2 : 1,
					ori == 0 ? plotTop : plotLft,
					ori == 0 ? plotHgt : plotWid,
					roundDec(grid.width * pxRatio, 3),
					grid.stroke(this.u, i),
					grid.dash,
					grid.cap,
				);
			}

			// Draw border
			if (border.show) {
				this.drawOrthoLines(
					[basePos],
					[1],
					ori == 0 ? 1 : 0,
					ori == 0 ? 1 : 2,
					ori == 1 ? plotTop : plotLft,
					ori == 1 ? plotHgt : plotWid,
					roundDec(border.width * pxRatio, 3),
					border.stroke(this.u, i),
					border.dash,
					border.cap,
				);
			}
		}

		this.u.fire("drawAxes");
	}

	/**
	 * Draw axis label
	 */
	drawAxisLabel(axis, i, ori, side, fillStyle, shiftDir, _incr, _space) {
		const { plotLft, plotTop, plotWid, plotHgt, pxRatio, isFn, PI } = this.u;
		
		let shiftAmt = axis.labelGap * shiftDir;
		let baseLpos = round((axis._lpos + shiftAmt) * pxRatio);

		this.setFontStyle(axis.labelFont[0], fillStyle, "center", side == 2 ? TOP : BOTTOM);

		this.ctx.save();

		let x, y;
		if (ori == 1) {
			x = y = 0;
			this.ctx.translate(baseLpos, round(plotTop + plotHgt / 2));
			this.ctx.rotate((side == 3 ? -PI : PI) / 2);
		} else {
			x = round(plotLft + plotWid / 2);
			y = baseLpos;
		}

		let _label = isFn(axis.label) ? axis.label(this.u, i, _incr, _space) : axis.label;
		this.ctx.fillText(_label, x, y);
		this.ctx.restore();
	}

	/**
	 * Draw tick labels
	 */
	drawTickLabels(axis, i, ori, side, basePos, tickSize, axisGap, shiftDir, canOffs, fillStyle) {
		const { PI } = this.u;
		
		let angle = axis._rotate * -PI / 180;
		let shiftAmt = (tickSize + axisGap) * shiftDir;
		let finalPos = basePos + shiftAmt;
		let y = ori == 0 ? finalPos : 0;
		let x = ori == 1 ? finalPos : 0;

		let font = axis.font[0];
		let textAlign = axis.align == 1 ? LEFT :
			axis.align == 2 ? RIGHT :
			angle > 0 ? LEFT :
			angle < 0 ? RIGHT :
			ori == 0 ? "center" : side == 3 ? RIGHT : LEFT;
		let textBaseline = angle ||
			ori == 1 ? "middle" : side == 2 ? TOP : BOTTOM;

		this.setFontStyle(font, fillStyle, textAlign, textBaseline);

		let lineHeight = axis.font[1] * axis.lineGap;
		let _values = axis._values;

		for (let i = 0; i < _values.length; i++) {
			let val = _values[i];

			if (val != null) {
				if (ori == 0) {
					x = canOffs[i];
				} else {
					y = canOffs[i];
				}

				val = "" + val;
				let _parts = val.indexOf("\n") == -1 ? [val] : val.split(/\n/gm);

				for (let j = 0; j < _parts.length; j++) {
					let text = _parts[j];

					if (angle) {
						this.ctx.save();
						this.ctx.translate(x, y + j * lineHeight);
						this.ctx.rotate(angle);
						this.ctx.fillText(text, 0, 0);
						this.ctx.restore();
					} else {
						this.ctx.fillText(text, x, y + j * lineHeight);
					}
				}
			}
		}
	}

	/**
	 * Cache stroke and fill styles for series or points
	 */
	cacheStrokeFill(si, _points) {
		const { series } = this.u;
		let s = _points ? series[si].points : series[si];

		s._stroke = s.stroke(this.u, si);
		s._fill = s.fill(this.u, si);
	}

	/**
	 * Draw a path for series or points
	 */
	drawPath(si, _points) {
		const { series, bands, plotLft, plotTop, plotWid, plotHgt, pxRatio } = this.u;
		let s = _points ? series[si].points : series[si];

		let {
			stroke,
			fill,
			clip: gapsClip,
			flags,
			_stroke: strokeStyle = s._stroke,
			_fill: fillStyle = s._fill,
			_width: width = s.width,
		} = s._paths;

		width = roundDec(width * pxRatio, 3);

		let boundsClip = null;
		let offset = (width % 2) / 2;

		if (_points && fillStyle == null) {
			fillStyle = width > 0 ? "#fff" : strokeStyle;
		}

		let _pxAlign = s.pxAlign == 1 && offset > 0;

		if (_pxAlign) {
			this.ctx.translate(offset, offset);
		}

		if (!_points) {
			let lft = plotLft - width / 2,
				top = plotTop - width / 2,
				wid = plotWid + width,
				hgt = plotHgt + width;

			boundsClip = new Path2D();
			boundsClip.rect(lft, top, wid, hgt);
		}

		// Draw points or series with bands
		if (_points) {
			this.strokeFill(strokeStyle, width, s.dash, s.cap, fillStyle, stroke, fill, flags, gapsClip);
		} else {
			this.fillStroke(si, strokeStyle, width, s.dash, s.cap, fillStyle, stroke, fill, flags, boundsClip, gapsClip);
		}

		if (_pxAlign) {
			this.ctx.translate(-offset, -offset);
		}
	}

	/**
	 * Handle fill and stroke operations with band support
	 */
	fillStroke(si, strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip) {
		const { bands, series, data, hasData, i0, i1, isArr, EMPTY_OBJ } = this.u;
		let didStrokeFill = false;

		// Handle bands
		if (flags != 0) {
			bands.forEach((b, bi) => {
				if (b.series[0] == si) {
					let lowerEdge = series[b.series[1]];
					let lowerData = data[b.series[1]];
					let bandClip = (lowerEdge._paths || EMPTY_OBJ).band;

					if (isArr(bandClip)) {
						bandClip = b.dir == 1 ? bandClip[0] : bandClip[1];
					}

					let gapsClip2;
					let _fillStyle = null;

					if (lowerEdge.show && bandClip && hasData(lowerData, i0, i1)) {
						_fillStyle = b.fill(this.u, bi) || fillStyle;
						gapsClip2 = lowerEdge._paths.clip;
					} else {
						bandClip = null;
					}

					this.strokeFill(strokeStyle, lineWidth, lineDash, lineCap, _fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip);
					didStrokeFill = true;
				}
			});
		}

		if (!didStrokeFill) {
			this.strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip);
		}
	}

	/**
	 * Core stroke and fill operation with clipping support
	 */
	strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip) {
		this.setCtxStyle(strokeStyle, lineWidth, lineDash, lineCap, fillStyle);

		if (boundsClip || gapsClip || bandClip) {
			this.ctx.save();
			if (boundsClip) this.ctx.clip(boundsClip);
			if (gapsClip) this.ctx.clip(gapsClip);
		}

		if (bandClip) {
			if ((flags & this.CLIP_FILL_STROKE) == this.CLIP_FILL_STROKE) {
				this.ctx.clip(bandClip);
				if (gapsClip2) this.ctx.clip(gapsClip2);
				this.doFill(fillStyle, fillPath);
				this.doStroke(strokeStyle, strokePath, lineWidth);
			} else if (flags & BAND_CLIP_STROKE) {
				this.doFill(fillStyle, fillPath);
				this.ctx.clip(bandClip);
				this.doStroke(strokeStyle, strokePath, lineWidth);
			} else if (flags & BAND_CLIP_FILL) {
				this.ctx.save();
				this.ctx.clip(bandClip);
				if (gapsClip2) this.ctx.clip(gapsClip2);
				this.doFill(fillStyle, fillPath);
				this.ctx.restore();
				this.doStroke(strokeStyle, strokePath, lineWidth);
			}
		} else {
			this.doFill(fillStyle, fillPath);
			this.doStroke(strokeStyle, strokePath, lineWidth);
		}

		if (boundsClip || gapsClip || bandClip) {
			this.ctx.restore();
		}
	}

	/**
	 * Perform stroke operation
	 */
	doStroke(strokeStyle, strokePath, lineWidth) {
		if (lineWidth > 0) {
			if (strokePath instanceof Map) {
				strokePath.forEach((strokePath, strokeStyle) => {
					this.ctx.strokeStyle = this.ctxStroke = strokeStyle;
					this.ctx.stroke(strokePath);
				});
			} else if (strokePath != null && strokeStyle) {
				this.ctx.stroke(strokePath);
			}
		}
	}

	/**
	 * Perform fill operation
	 */
	doFill(fillStyle, fillPath) {
		if (fillPath instanceof Map) {
			fillPath.forEach((fillPath, fillStyle) => {
				this.ctx.fillStyle = this.ctxFill = fillStyle;
				this.ctx.fill(fillPath);
			});
		} else if (fillPath != null && fillStyle) {
			this.ctx.fill(fillPath);
		}
	}

	/**
	 * Draw orthogonal lines (ticks, grid, borders)
	 */
	drawOrthoLines(offs, filts, ori, side, pos0, len, width, stroke, dash, cap) {
		const { pxAlign } = this.u;
		let offset = (width % 2) / 2;

		if (pxAlign == 1) {
			this.ctx.translate(offset, offset);
		}

		this.setCtxStyle(stroke, width, dash, cap, stroke);
		this.ctx.beginPath();

		let x0, y0, x1, y1, pos1 = pos0 + (side == 0 || side == 3 ? -len : len);

		if (ori == 0) {
			y0 = pos0;
			y1 = pos1;
		} else {
			x0 = pos0;
			x1 = pos1;
		}

		for (let i = 0; i < offs.length; i++) {
			if (filts[i] != null) {
				if (ori == 0) {
					x0 = x1 = offs[i];
				} else {
					y0 = y1 = offs[i];
				}

				this.ctx.moveTo(x0, y0);
				this.ctx.lineTo(x1, y1);
			}
		}

		this.ctx.stroke();

		if (pxAlign == 1) {
			this.ctx.translate(-offset, -offset);
		}
	}

	/**
	 * Set canvas context style with caching for performance
	 */
	setCtxStyle(stroke, width, dash, cap, fill, join) {
		stroke ??= transparent;
		dash ??= EMPTY_ARR;
		cap ??= "butt";
		join ??= "round";

		if (stroke != this.ctxStroke) {
			this.ctx.strokeStyle = this.ctxStroke = stroke;
		}
		if (fill != this.ctxFill) {
			this.ctx.fillStyle = this.ctxFill = fill;
		}
		if (width != this.ctxWidth) {
			this.ctx.lineWidth = this.ctxWidth = width;
		}
		if (dash != this.ctxDash) {
			this.ctx.setLineDash(this.ctxDash = dash);
		}
		if (cap != this.ctxCap) {
			this.ctx.lineCap = this.ctxCap = cap;
		}
		if (join != this.ctxJoin) {
			this.ctx.lineJoin = this.ctxJoin = join;
		}
	}

	/**
	 * Set font style with caching
	 */
	setFontStyle(font, fill, align, baseline) {
		if (fill != this.ctxFill) {
			this.ctx.fillStyle = this.ctxFill = fill;
		}
		if (font != this.ctxFont) {
			this.ctx.font = this.ctxFont = font;
		}
		if (align != this.ctxAlign) {
			this.ctx.textAlign = this.ctxAlign = align;
		}
		if (baseline != this.ctxBaseline) {
			this.ctx.textBaseline = this.ctxBaseline = baseline;
		}
	}

	/**
	 * Get outer indices for data range
	 */
	getOuterIdxs(data) {
		let i0 = 0;
		let i1 = data.length - 1;
		
		// Find first non-null value
		while (i0 <= i1 && data[i0] == null) {
			i0++;
		}
		
		// Find last non-null value
		while (i1 >= i0 && data[i1] == null) {
			i1--;
		}
		
		return [i0, i1];
	}

	/**
	 * Invalidate style cache (called when canvas is resized)
	 */
	invalidateStyleCache() {
		this.ctxStroke = this.ctxFill = this.ctxWidth = this.ctxJoin = this.ctxCap = this.ctxFont = this.ctxAlign = this.ctxBaseline = this.ctxDash = null;
		this.ctxAlpha = 1;
	}
}

/**
 * UPlotCore - Main uPlot class that orchestrates all modules and provides the public API
 */


/**
 * UPlotCore class - orchestrates all modules and provides the public API
 */
class UPlotCore {
	constructor(opts, data, target) {
		// Initialize basic properties
		this.opts = copy(opts);
		this.data = data || [];
		this._data = this.data;
		this.target = target;
		
		// Status tracking
		this.status = 0;
		this.ready = false;
		
		// Pixel ratio management
		this.pxRatio = opts.pxRatio ?? pxRatio;
		
		// Mode (1 = time series, 2 = scatter plot)
		this.mode = ifNull(opts.mode, 1);
		
		// Initialize dimensions from options
		this._width = opts.width || 800;
		this._height = opts.height || 400;
		
		// Initialize DOM structure
		this.initDOM();
		
		// Initialize managers
		this.initManagers();
		
		// Initialize configuration
		this.initConfiguration();
		
		// Process plugins
		this.processPlugins();
		
		// Initialize all systems
		this.initSystems();
		
		// Set initial data if provided
		if (data && data.length > 0) {
			this.setData(data, false);
		}
		
		// Mark as ready
		this.ready = true;
		this.status = 1;
		
		// Fire ready event
		this.fire("ready");
	}

	/**
	 * Initialize DOM structure
	 */
	initDOM() {
		// Create root container
		this.root = placeDiv(UPLOT);
		
		if (this.opts.id != null) {
			this.root.id = this.opts.id;
		}
		
		addClass(this.root, this.opts.class);
		
		// Add title if specified
		if (this.opts.title) {
			let title = placeDiv(TITLE, this.root);
			title.textContent = this.opts.title;
		}
		
		// Create canvas and context
		this.can = placeTag("canvas");
		this.ctx = this.can.getContext("2d");
		
		// Create wrapper and layers
		this.wrap = placeDiv(WRAP, this.root);
		this.under = placeDiv(UNDER, this.wrap);
		this.wrap.appendChild(this.can);
		this.over = placeDiv(OVER, this.wrap);
		
		// Initialize bounding box
		this.bbox = {};
		
		// Handle target - can be HTMLElement or function
		if (this.target) {
			if (typeof this.target === 'function') {
				// Function target - call with self and init function
				this.target(this, () => {
					// Init function - no-op for now since we're already initialized
				});
			} else {
				// HTMLElement target - append root
				this.target.appendChild(this.root);
			}
		}
	}

	/**
	 * Initialize all manager instances
	 */
	initManagers() {
		this.layout = new LayoutManager(this);
		this.scales = new ScaleManager(this, this.opts);
		this.events = new EventManager(this);
		this.cursor = new CursorManager(this);
		this.legend = new LegendManager(this);
		this.series = new SeriesManager(this, this.scales);
		this.axes = new AxisManager(this, this.scales);
		this.renderer = new Renderer(this, this.layout);
	}

	/**
	 * Initialize configuration from options
	 */
	initConfiguration() {
		// Initialize pixel alignment
		this.pxAlign = +ifNull(this.opts.pxAlign, 1);
		this.pxRound = this.pxRoundGen(this.pxAlign);
		
		// Initialize time settings
		this.ms = this.opts.ms || 1e-3;
		
		// Initialize focus settings
		this.focus = assign({}, this.opts.focus || {alpha: 0.3});
		
		// Initialize bands
		this.bands = this.opts.bands || [];
		this.bands.forEach(b => {
			b.fill = fnOrSelf(b.fill || null);
			b.dir = ifNull(b.dir, -1);
		});
		
		// State flags
		this.shouldSetScales = false;
		this.shouldSetSize = false;
		this.shouldConvergeSize = false;
		this.shouldSetCursor = false;
		this.shouldSetSelect = false;
		this.shouldSetLegend = false;
		
		// Active indices for cursor/legend
		this.activeIdxs = [];
		
		// Data window indices
		this.i0 = null;
		this.i1 = null;
		this.data0 = null;
		
		// Selection state
		this.select = {
			show: false,
			over: true,
			left: 0,
			width: 0,
			top: 0,
			height: 0,
		};
	}

	/**
	 * Process plugins and apply their options
	 */
	processPlugins() {
		(this.opts.plugins || []).forEach(p => {
			if (p.opts) {
				this.opts = p.opts(this, this.opts) || this.opts;
			}
		});
	}

	/**
	 * Initialize all systems
	 */
	initSystems() {
		// Initialize series first (needed by scales)
		this.series.initSeries(this.opts, this.data);
		
		// Initialize axes configuration (needed by scales)
		this.axesConfig = this.axesConfig || [];
		if (this.opts.axes) {
			this.axesConfig = this.opts.axes;
		}
		
		// Initialize scales (needs series and axes)
		this.scales.initScales();
		
		// Initialize axes properly (this.axes is the AxisManager instance)
		this.axes.initAxes(this.opts);
		
		// Initialize cursor
		this.cursor.initCursor(this.opts, this.series, this.activeIdxs, this.mode, this.over, this.focus);
		
		// Initialize legend
		this.legend.initLegend(this.opts, this.series, this.activeIdxs, this.mode, this.root, this.cursor.cursor, {});
		
		// Initialize events
		this.events.initEvents(this.opts);
		
		// Set orientation classes
		const scaleX = this.scales.getXScale();
		if (scaleX && scaleX.ori == 0) {
			addClass(this.root, ORI_HZ);
		} else {
			addClass(this.root, ORI_VT);
		}
		
		// Calculate layout before initializing canvas
		this.layout.calcSize(this._width, this._height);
		
		// Initialize canvas
		this.renderer.initCanvas(this.opts);
	}

	/**
	 * Set pixel ratio and update related systems
	 */
	setPxRatio(pxRatio$1) {
		this.pxRatio = pxRatio$1 ?? pxRatio;
		this.axes.syncFontSizes(this.pxRatio);
		this._setSize(this._width, this._height, true);
	}

	/**
	 * Set chart data
	 */
	setData(data, resetScales = true) {
		this.data = data == null ? [] : data;
		this._data = this.data;
		
		// Handle mode-specific data processing
		if (this.mode == 2) {
			this.dataLen = 0;
			for (let i = 1; i < this.series.series.length; i++) {
				this.dataLen += this.data[i][0].length;
			}
		} else {
			if (this.data.length == 0) {
				this.data = this._data = [[]];
			}
			
			this.data0 = this.data[0];
			this.dataLen = this.data0.length;
			
			// Handle ordinal scale data transformation
			let scaleData = this.data;
			const xScale = this.scales.getXScale();
			
			if (xScale.distr == 2) {
				scaleData = this.data.slice();
				let _data0 = scaleData[0] = Array(this.dataLen);
				for (let i = 0; i < this.dataLen; i++) {
					_data0[i] = i;
				}
			}
			
			this._data = this.data = scaleData;
		}
		
		// Reset series paths
		this.series.resetYSeries(true);
		
		// Fire setData event
		this.fire("setData");
		
		// Handle scale updates
		if (resetScales !== false) {
			let xsc = this.scales.getXScale();
			
			if (xsc.auto(this, this.scales.viaAutoScaleX)) {
				this.scales.autoScaleX();
			} else {
				this.scales._setScale(this.scales.xScaleKey, xsc.min, xsc.max);
			}
			
			this.shouldSetCursor = this.shouldSetCursor || this.cursor.cursor.left >= 0;
			this.shouldSetLegend = true;
			this.commit();
		}
	}

	/**
	 * Set chart size
	 */
	setSize(opts) {
		this._setSize(opts.width, opts.height);
	}

	/**
	 * Internal size setting with force option
	 */
	_setSize(width, height, force) {
		if (force || (width != this.width || height != this.height)) {
			this.layout.calcSize(width, height);
		}
		
		this.series.resetYSeries(false);
		
		this.shouldConvergeSize = true;
		this.shouldSetSize = true;
		
		this.commit();
	}

	/**
	 * Add a new series
	 */
	addSeries(opts, si) {
		si = this.series.addSeries(opts, si);
		
		// Update cursor and legend
		if (this.cursor.showCursor) {
			this.cursor.addCursorPt(this.series.series[si], si, this.over, this.layout.plotWidCss, this.layout.plotHgtCss);
		}
		
		if (this.legend.showLegend) {
			this.legend.addLegendRow(this.series.series[si], si, this.series.series, this.mode, this.cursor.cursor, {});
		}
		
		return si;
	}

	/**
	 * Remove a series
	 */
	delSeries(i) {
		this.series.delSeries(i);
		
		// Update cursor and legend
		if (this.cursor.showCursor) {
			this.cursor.removeCursorPt(i);
		}
		
		if (this.legend.showLegend) {
			this.legend.removeLegendRow(i);
		}
		
		return i;
	}

	/**
	 * Update series configuration
	 */
	setSeries(i, opts, _fire, _pub) {
		this.series.setSeries(i, opts, _fire, _pub);
		
		// Update legend if needed
		if (this.legend.showLegend && opts.show != null) {
			this.legend.updateSeriesLegend(i, this.series.series[i]);
		}
	}

	/**
	 * Set cursor position
	 */
	setCursor(opts, _fire, _pub) {
		this.cursor.setCursor(opts, _fire, _pub);
	}

	/**
	 * Set legend values
	 */
	setLegend(opts, _fire) {
		this.legend.setLegend(opts, _fire);
	}

	/**
	 * Set selection area
	 */
	setSelect(opts, _fire) {
		assign(this.select, opts);
		
		this.shouldSetSelect = true;
		
		if (_fire !== false) {
			this.commit();
		}
	}

	/**
	 * Commit pending changes and trigger redraw
	 */
	commit() {
		if (!this.ready) return;
		
		// Handle size convergence
		if (this.shouldConvergeSize) {
			this.layout.convergeSize(this._width, this._height);
			this.shouldConvergeSize = false;
		}
		
		// Handle size changes
		if (this.shouldSetSize) {
			this.renderer.initCanvas(this.opts);
			this.shouldSetSize = false;
		}
		
		// Handle scale changes
		if (this.shouldSetScales) {
			let changed = this.scales.setScales();
			this.series.updateSeriesForScaleChange(changed);
			this.shouldSetScales = false;
		}
		
		// Handle cursor updates
		if (this.shouldSetCursor) {
			this.cursor.updateCursor();
			this.shouldSetCursor = false;
		}
		
		// Handle legend updates
		if (this.shouldSetLegend) {
			this.legend.setLegend();
			this.shouldSetLegend = false;
		}
		
		// Trigger redraw
		this.renderer.draw();
	}

	/**
	 * Destroy the chart and clean up resources
	 */
	destroy() {
		this.fire("destroy");
		
		// Clean up managers
		this.events.destroy();
		this.cursor.destroy();
		this.legend.destroy();
		
		// Remove DOM elements
		if (this.root.parentNode) {
			this.root.parentNode.removeChild(this.root);
		}
		
		// Clear references
		this.ready = false;
		this.status = 0;
	}

	/**
	 * Fire an event
	 */
	fire(type, ...args) {
		if (this.opts.hooks && this.opts.hooks[type]) {
			this.opts.hooks[type].forEach(fn => fn(this, ...args));
		}
	}

	/**
	 * Sync with other charts
	 */
	pubSync(type, src, ...args) {
		if (this.opts.sync) {
			_sync.pub(type, src, ...args);
		}
	}

	/**
	 * Generate pixel rounding function
	 */
	pxRoundGen(pxAlign) {
		return pxAlign == 1 ? v => round(v) : v => incrRound(v, pxAlign);
	}

	/**
	 * Get position from value (orientation-aware)
	 */
	getPos(val, scale, dim, off) {
		return this.scales.getPos(val, scale, dim, off);
	}

	/**
	 * Convert value to X position
	 */
	valToPosX(val, scale, dim, off) {
		return this.scales.valToPosX(val, scale, dim, off);
	}

	/**
	 * Convert value to Y position  
	 */
	valToPosY(val, scale, dim, off) {
		return this.scales.valToPosY(val, scale, dim, off);
	}

	/**
	 * Convert X position to value
	 */
	posToValX(pos, can) {
		return this.scales.posToValX(pos, can);
	}

	/**
	 * Convert Y position to value
	 */
	posToValY(pos, scaleKey, can) {
		return this.scales.posToValY(pos, scaleKey, can);
	}

	/**
	 * Convert CSS pixel position to closest data index
	 */
	posToIdx(left, canvasPixels = false) {
		// Simple implementation - find closest x value
		const val = this.posToVal(left, this.scales.xScaleKey, canvasPixels);
		return this.valToIdx(val);
	}

	/**
	 * Convert CSS pixel position to value along given scale
	 */
	posToVal(leftTop, scaleKey, canvasPixels = false) {
		const scale = this.scales.scales[scaleKey];
		if (!scale) return null;
		
		if (scale.ori === 0) {
			// Horizontal scale (X)
			return this.posToValX(leftTop, canvasPixels);
		} else {
			// Vertical scale (Y)
			return this.posToValY(leftTop, scaleKey, canvasPixels);
		}
	}

	/**
	 * Convert value to CSS/canvas pixel position
	 */
	valToPos(val, scaleKey, canvasPixels = false) {
		const scale = this.scales.scales[scaleKey];
		if (!scale) return null;
		
		if (scale.ori === 0) {
			// Horizontal scale (X)
			return this.valToPosX(val, scale, canvasPixels ? this.plotWid : this.plotWidCss, canvasPixels ? this.plotLft : this.plotLftCss);
		} else {
			// Vertical scale (Y)
			return this.valToPosY(val, scale, canvasPixels ? this.plotHgt : this.plotHgtCss, canvasPixels ? this.plotTop : this.plotTopCss);
		}
	}

	/**
	 * Convert value to closest data index
	 */
	valToIdx(val) {
		if (!this.data0 || this.data0.length === 0) return 0;
		
		// Binary search for closest index
		let left = 0;
		let right = this.data0.length - 1;
		
		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const midVal = this.data0[mid];
			
			if (midVal === val) return mid;
			if (midVal < val) left = mid + 1;
			else right = mid - 1;
		}
		
		// Return closest index
		if (left >= this.data0.length) return this.data0.length - 1;
		if (right < 0) return 0;
		
		const leftDiff = Math.abs(this.data0[left] - val);
		const rightDiff = Math.abs(this.data0[right] - val);
		
		return leftDiff <= rightDiff ? left : right;
	}

	/**
	 * Redraw the chart
	 */
	redraw(rebuildPaths = true, recalcAxes = false) {
		if (rebuildPaths) {
			this.series.resetYSeries(true);
		}
		
		if (recalcAxes) {
			this.shouldSetScales = true;
		}
		
		this.commit();
	}

	/**
	 * Batch multiple operations
	 */
	batch(txn, deferHooks = false) {
		if (typeof txn === 'function') {
			txn();
		}
	}

	/**
	 * Get cached DOMRect
	 */
	get rect() {
		return this.cursor.rect || { left: 0, top: 0, width: this.plotWidCss, height: this.plotHgtCss };
	}

	/**
	 * Sync rect cache
	 */
	syncRect(force) {
		this.cursor.syncRect(force);
	}

	/**
	 * Update cursor position
	 */
	updateCursor(ts, _fire, _pub) {
		this.cursor.updateCursor(ts, _fire, _pub);
	}

	/**
	 * Set cursor event reference
	 */
	setCursorEvent(e) {
		this.cursor.setCursorEvent(e);
	}

	// Expose layout properties for backward compatibility
	get width() { return this.layout.fullWidCss; }
	get height() { return this.layout.fullHgtCss; }
	get plotWidCss() { return this.layout.plotWidCss; }
	get plotHgtCss() { return this.layout.plotHgtCss; }
	get plotLftCss() { return this.layout.plotLftCss; }
	get plotTopCss() { return this.layout.plotTopCss; }
	get plotLft() { return this.layout.plotLft; }
	get plotTop() { return this.layout.plotTop; }
	get plotWid() { return this.layout.plotWid; }
	get plotHgt() { return this.layout.plotHgt; }

	// Expose scale properties for backward compatibility
	get xScaleDistr() { 
		const xScale = this.scales.getXScale();
		return xScale ? xScale.distr : 1;
	}
}

/**
 * uPlot.js - Refactored main entry point
 * 
 * This file serves as the main entry point and orchestrates the modular components.
 * It maintains the existing constructor signature and API for backward compatibility.
 */


/**
 * Main uPlot constructor function - creates and returns a UPlotCore instance
 * Maintains existing constructor signature and behavior for API compatibility
 * 
 * @param {Object} opts - Configuration options
 * @param {Array} data - Chart data
 * @param {HTMLElement} target - Target DOM element (optional)
 * @returns {UPlotCore} - uPlot instance
 */
function uPlot(opts, data, target) {
	// Create and return UPlotCore instance with proper module orchestration
	const instance = new UPlotCore(opts, data, target);
	
	// Ensure all public API methods are properly delegated to modules
	// The UPlotCore class handles the orchestration internally
	return instance;
}

// Static properties and methods for backward compatibility
uPlot.assign = assign;
uPlot.fmtNum = fmtNum;
uPlot.rangeNum = rangeNum;
uPlot.rangeLog = rangeLog;
uPlot.rangeAsinh = rangeAsinh;
uPlot.orient = orient;
uPlot.pxRatio = pxRatio;

{
	uPlot.join = join;
}

{
	uPlot.fmtDate = fmtDate;
	uPlot.tzDate = tzDate;
}

uPlot.sync = _sync;

{
	uPlot.addGap = addGap;
	uPlot.clipGaps = clipGaps;

	let paths = uPlot.paths = {
		points,
	};

	(paths.linear  = linear);
	(paths.stepped = stepped);
	(paths.bars    = bars);
	(paths.spline  = monotoneCubic);
}

module.exports = uPlot;
