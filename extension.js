var _a;
const React = window.React;
const { useState, useCallback, useEffect, useMemo, useRef, createElement, Fragment, createContext, useContext, forwardRef, memo, lazy, Suspense, Component, PureComponent, Children, cloneElement, isValidElement, createRef } = React;
const ReactDOM = window.ReactDOM;
const { render, createPortal, unmountComponentAtNode, findDOMNode, hydrate, flushSync } = ReactDOM;
function getCorsProxyUrl() {
  var _a2, _b;
  return ((_b = (_a2 = window.roamAlphaAPI) == null ? void 0 : _a2.constants) == null ? void 0 : _b.corsAnywhereProxyUrl) || "";
}
const BLOCK_REF_REGEX$1 = /\(\(([\w\d-]{9,10})\)\)/g;
const PAGE_REF_REGEX$1 = /\[\[([^\]]+)\]\]/g;
const HASHTAG_PAGE_REF_REGEX$1 = /#\[\[([^\]]+)\]\]/g;
const IMAGE_REGEX$1 = /!\[[^\]]*\]\(([^\s)]*)\)/g;
const ALIAS_REGEX$1 = /\[([^\]]*)\]\(([^)]+)\)/g;
const BUTTON_REGEX$1 = /\{\{[^}]*\}\}/g;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;
const ITALIC_REGEX = /__(.+?)__/g;
const HIGHLIGHT_REGEX = /\^\^(.+?)\^\^/g;
const STRIKETHROUGH_REGEX = /~~(.+?)~~/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
function processBlockText(raw) {
  if (!raw) return { text: "", mediaUrls: [] };
  let text = raw;
  const mediaUrls = [];
  text = text.replace(IMAGE_REGEX$1, (_, url) => {
    mediaUrls.push(url);
    return "";
  });
  text = text.replace(BLOCK_REF_REGEX$1, (_, uid) => {
    try {
      const result = window.roamAlphaAPI.data.pull(
        "[:block/string]",
        [":block/uid", uid]
      );
      return (result == null ? void 0 : result[":block/string"]) || "";
    } catch {
      return "";
    }
  });
  text = text.replace(ALIAS_REGEX$1, "$2");
  text = text.replace(HASHTAG_PAGE_REF_REGEX$1, (_, pageName) => {
    return `#${pageName.replace(/\s+/g, "")}`;
  });
  text = text.replace(PAGE_REF_REGEX$1, (_, pageName) => {
    return `#${pageName.replace(/\s+/g, "")}`;
  });
  text = text.replace(BOLD_REGEX, "$1");
  text = text.replace(ITALIC_REGEX, "$1");
  text = text.replace(HIGHLIGHT_REGEX, "$1");
  text = text.replace(STRIKETHROUGH_REGEX, "$1");
  text = text.replace(INLINE_CODE_REGEX, "$1");
  text = text.replace(BUTTON_REGEX$1, "");
  text = text.replace(/  +/g, " ").trim();
  return { text, mediaUrls };
}
function resolveBlockText(raw) {
  return processBlockText(raw).text;
}
function getChildBlocks(blockUid) {
  try {
    const result = window.roamAlphaAPI.data.pull(
      "[:block/string :block/uid :block/order {:block/children [:block/string :block/uid :block/order]}]",
      [":block/uid", blockUid]
    );
    const children = (result == null ? void 0 : result[":block/children"]) || [];
    return children.sort((a, b) => a[":block/order"] - b[":block/order"]).map((c) => ({
      uid: c[":block/uid"],
      text: c[":block/string"] || ""
    }));
  } catch {
    return [];
  }
}
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var oauth1_0a = { exports: {} };
(function(module, exports$1) {
  {
    module.exports = OAuth2;
  }
  function OAuth2(opts) {
    if (!(this instanceof OAuth2)) {
      return new OAuth2(opts);
    }
    if (!opts) {
      opts = {};
    }
    if (!opts.consumer) {
      throw new Error("consumer option is required");
    }
    this.consumer = opts.consumer;
    this.nonce_length = opts.nonce_length || 32;
    this.version = opts.version || "1.0";
    this.parameter_seperator = opts.parameter_seperator || ", ";
    this.realm = opts.realm;
    if (typeof opts.last_ampersand === "undefined") {
      this.last_ampersand = true;
    } else {
      this.last_ampersand = opts.last_ampersand;
    }
    this.signature_method = opts.signature_method || "PLAINTEXT";
    if (this.signature_method == "PLAINTEXT" && !opts.hash_function) {
      opts.hash_function = function(base_string, key) {
        return key;
      };
    }
    if (!opts.hash_function) {
      throw new Error("hash_function option is required");
    }
    this.hash_function = opts.hash_function;
    this.body_hash_function = opts.body_hash_function || this.hash_function;
  }
  OAuth2.prototype.authorize = function(request, token) {
    var oauth_data = {
      oauth_consumer_key: this.consumer.key,
      oauth_nonce: this.getNonce(),
      oauth_signature_method: this.signature_method,
      oauth_timestamp: this.getTimeStamp(),
      oauth_version: this.version
    };
    if (!token) {
      token = {};
    }
    if (token.key !== void 0) {
      oauth_data.oauth_token = token.key;
    }
    if (!request.data) {
      request.data = {};
    }
    if (request.includeBodyHash) {
      oauth_data.oauth_body_hash = this.getBodyHash(request, token.secret);
    }
    oauth_data.oauth_signature = this.getSignature(request, token.secret, oauth_data);
    return oauth_data;
  };
  OAuth2.prototype.getSignature = function(request, token_secret, oauth_data) {
    return this.hash_function(this.getBaseString(request, oauth_data), this.getSigningKey(token_secret));
  };
  OAuth2.prototype.getBodyHash = function(request, token_secret) {
    var body = typeof request.data === "string" ? request.data : JSON.stringify(request.data);
    if (!this.body_hash_function) {
      throw new Error("body_hash_function option is required");
    }
    return this.body_hash_function(body, this.getSigningKey(token_secret));
  };
  OAuth2.prototype.getBaseString = function(request, oauth_data) {
    return request.method.toUpperCase() + "&" + this.percentEncode(this.getBaseUrl(request.url)) + "&" + this.percentEncode(this.getParameterString(request, oauth_data));
  };
  OAuth2.prototype.getParameterString = function(request, oauth_data) {
    var base_string_data;
    if (oauth_data.oauth_body_hash) {
      base_string_data = this.sortObject(this.percentEncodeData(this.mergeObject(oauth_data, this.deParamUrl(request.url))));
    } else {
      base_string_data = this.sortObject(this.percentEncodeData(this.mergeObject(oauth_data, this.mergeObject(request.data, this.deParamUrl(request.url)))));
    }
    var data_str = "";
    for (var i = 0; i < base_string_data.length; i++) {
      var key = base_string_data[i].key;
      var value = base_string_data[i].value;
      if (value && Array.isArray(value)) {
        value.sort();
        var valString = "";
        value.forEach((function(item, i2) {
          valString += key + "=" + item;
          if (i2 < value.length) {
            valString += "&";
          }
        }).bind(this));
        data_str += valString;
      } else {
        data_str += key + "=" + value + "&";
      }
    }
    data_str = data_str.substr(0, data_str.length - 1);
    return data_str;
  };
  OAuth2.prototype.getSigningKey = function(token_secret) {
    token_secret = token_secret || "";
    if (!this.last_ampersand && !token_secret) {
      return this.percentEncode(this.consumer.secret);
    }
    return this.percentEncode(this.consumer.secret) + "&" + this.percentEncode(token_secret);
  };
  OAuth2.prototype.getBaseUrl = function(url) {
    return url.split("?")[0];
  };
  OAuth2.prototype.deParam = function(string) {
    var arr = string.split("&");
    var data = {};
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i].split("=");
      item[1] = item[1] || "";
      if (data[item[0]]) {
        if (!Array.isArray(data[item[0]])) {
          data[item[0]] = [data[item[0]]];
        }
        data[item[0]].push(decodeURIComponent(item[1]));
      } else {
        data[item[0]] = decodeURIComponent(item[1]);
      }
    }
    return data;
  };
  OAuth2.prototype.deParamUrl = function(url) {
    var tmp = url.split("?");
    if (tmp.length === 1)
      return {};
    return this.deParam(tmp[1]);
  };
  OAuth2.prototype.percentEncode = function(str) {
    return encodeURIComponent(str).replace(/\!/g, "%21").replace(/\*/g, "%2A").replace(/\'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  };
  OAuth2.prototype.percentEncodeData = function(data) {
    var result = {};
    for (var key in data) {
      var value = data[key];
      if (value && Array.isArray(value)) {
        var newValue = [];
        value.forEach((function(val) {
          newValue.push(this.percentEncode(val));
        }).bind(this));
        value = newValue;
      } else {
        value = this.percentEncode(value);
      }
      result[this.percentEncode(key)] = value;
    }
    return result;
  };
  OAuth2.prototype.toHeader = function(oauth_data) {
    var sorted = this.sortObject(oauth_data);
    var header_value = "OAuth ";
    if (this.realm) {
      header_value += 'realm="' + this.realm + '"' + this.parameter_seperator;
    }
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].key.indexOf("oauth_") !== 0)
        continue;
      header_value += this.percentEncode(sorted[i].key) + '="' + this.percentEncode(sorted[i].value) + '"' + this.parameter_seperator;
    }
    return {
      Authorization: header_value.substr(0, header_value.length - this.parameter_seperator.length)
      //cut the last chars
    };
  };
  OAuth2.prototype.getNonce = function() {
    var word_characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var result = "";
    for (var i = 0; i < this.nonce_length; i++) {
      result += word_characters[parseInt(Math.random() * word_characters.length, 10)];
    }
    return result;
  };
  OAuth2.prototype.getTimeStamp = function() {
    return parseInt((/* @__PURE__ */ new Date()).getTime() / 1e3, 10);
  };
  OAuth2.prototype.mergeObject = function(obj1, obj2) {
    obj1 = obj1 || {};
    obj2 = obj2 || {};
    var merged_obj = obj1;
    for (var key in obj2) {
      merged_obj[key] = obj2[key];
    }
    return merged_obj;
  };
  OAuth2.prototype.sortObject = function(data) {
    var keys = Object.keys(data);
    var result = [];
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      result.push({
        key,
        value: data[key]
      });
    }
    return result;
  };
})(oauth1_0a);
var oauth1_0aExports = oauth1_0a.exports;
const OAuth = /* @__PURE__ */ getDefaultExportFromCjs(oauth1_0aExports);
const CryptoJS = window.CryptoJS;
const { HmacSHA1, enc, SHA256, MD5, AES, lib } = CryptoJS;
const TWITTER_CHAR_LIMIT = 280;
const TWITTER_API_BASE = "https://api.x.com/2";
function getCredentials$2(extensionAPI) {
  const apiKey = extensionAPI.settings.get("twitter-api-key");
  const apiSecret = extensionAPI.settings.get("twitter-api-secret");
  const accessToken = extensionAPI.settings.get("twitter-access-token");
  const accessTokenSecret = extensionAPI.settings.get("twitter-access-token-secret");
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}
function createOAuthHeader(creds, url, method) {
  const oauth = new OAuth({
    consumer: { key: creds.apiKey, secret: creds.apiSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
    }
  });
  const token = { key: creds.accessToken, secret: creds.accessTokenSecret };
  const authHeader = oauth.toHeader(oauth.authorize({ url, method }, token));
  return authHeader.Authorization;
}
function isTwitterConfigured(extensionAPI) {
  return getCredentials$2(extensionAPI) !== null;
}
function validateTwitterThread(blocks) {
  const errors = [];
  const counts = [];
  for (const block of blocks) {
    const { text } = processBlockText(block.text);
    const len = text.length;
    counts.push({ uid: block.uid, count: len });
    if (len === 0) {
      errors.push({ uid: block.uid, reason: "Tweet is empty" });
    } else if (len > TWITTER_CHAR_LIMIT) {
      errors.push({ uid: block.uid, reason: `Tweet is ${len - TWITTER_CHAR_LIMIT} chars over limit` });
    }
  }
  return { valid: errors.length === 0, errors, counts };
}
async function postToTwitter(content, extensionAPI) {
  var _a2;
  const creds = getCredentials$2(extensionAPI);
  if (!creds) {
    return { success: false, platform: "twitter", error: "Twitter credentials not configured" };
  }
  const corsProxy = getCorsProxyUrl();
  let inReplyToId;
  let firstTweetUrl;
  for (const block of content.blocks) {
    const { text } = processBlockText(block.text);
    const url = `${TWITTER_API_BASE}/tweets`;
    const body = { text };
    if (inReplyToId) {
      body.reply = { in_reply_to_tweet_id: inReplyToId };
    }
    const authorization = createOAuthHeader(creds, url, "POST");
    try {
      const response = await fetch(`${corsProxy}/${url}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData == null ? void 0 : errorData.detail) || (errorData == null ? void 0 : errorData.title) || `HTTP ${response.status}`;
        return { success: false, platform: "twitter", error: errorMsg };
      }
      const data = await response.json();
      const tweetId = (_a2 = data.data) == null ? void 0 : _a2.id;
      inReplyToId = tweetId;
      if (!firstTweetUrl && tweetId) {
        firstTweetUrl = `https://x.com/i/web/status/${tweetId}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, platform: "twitter", error: msg };
    }
  }
  return { success: true, platform: "twitter", url: firstTweetUrl };
}
const TWITTER_CHAR_MAX = TWITTER_CHAR_LIMIT;
const BLUESKY_CHAR_LIMIT = 300;
const BSKY_API_BASE = "https://bsky.social/xrpc";
function getCredentials$1(extensionAPI) {
  const handle = extensionAPI.settings.get("bluesky-handle");
  const appPassword = extensionAPI.settings.get("bluesky-app-password");
  if (!handle || !appPassword) return null;
  return { handle, appPassword };
}
async function createSession(handle, appPassword) {
  const corsProxy = getCorsProxyUrl();
  const url = `${BSKY_API_BASE}/com.atproto.server.createSession`;
  const response = await fetch(`${corsProxy}/${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err == null ? void 0 : err.message) || `Bluesky auth failed: ${response.status}`);
  }
  const data = await response.json();
  return { accessJwt: data.accessJwt, did: data.did };
}
function detectFacets(text) {
  const encoder = new TextEncoder();
  const facets = [];
  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const beforeBytes = encoder.encode(text.slice(0, match.index)).byteLength;
    const matchBytes = encoder.encode(match[0]).byteLength;
    facets.push({
      index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }]
    });
  }
  const mentionRegex = /@([a-zA-Z0-9._-]+(?:\.[a-zA-Z0-9._-]+)*)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    const handle = match[1];
    if (handle.includes(".")) {
      const beforeBytes = encoder.encode(text.slice(0, match.index)).byteLength;
      const matchBytes = encoder.encode(match[0]).byteLength;
      facets.push({
        index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
        features: [{ $type: "app.bsky.richtext.facet#mention", did: handle }]
      });
    }
  }
  return facets;
}
function isBlueskyConfigured(extensionAPI) {
  return getCredentials$1(extensionAPI) !== null;
}
function validateBlueskyThread(blocks) {
  const errors = [];
  const counts = [];
  for (const block of blocks) {
    const { text } = processBlockText(block.text);
    const len = [...text].length;
    counts.push({ uid: block.uid, count: len });
    if (len === 0) {
      errors.push({ uid: block.uid, reason: "Post is empty" });
    } else if (len > BLUESKY_CHAR_LIMIT) {
      errors.push({ uid: block.uid, reason: `Post is ${len - BLUESKY_CHAR_LIMIT} chars over limit` });
    }
  }
  return { valid: errors.length === 0, errors, counts };
}
async function postToBluesky(content, extensionAPI) {
  const creds = getCredentials$1(extensionAPI);
  if (!creds) {
    return { success: false, platform: "bluesky", error: "Bluesky credentials not configured" };
  }
  let session;
  try {
    session = await createSession(creds.handle, creds.appPassword);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "bluesky", error: msg };
  }
  const corsProxy = getCorsProxyUrl();
  let rootRef;
  let parentRef;
  let firstPostUri;
  for (const block of content.blocks) {
    const { text } = processBlockText(block.text);
    const facets = detectFacets(text);
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (facets.length > 0) {
      record.facets = facets;
    }
    if (parentRef && rootRef) {
      record.reply = { root: rootRef, parent: parentRef };
    }
    const url = `${BSKY_API_BASE}/com.atproto.repo.createRecord`;
    try {
      const response = await fetch(`${corsProxy}/${url}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return {
          success: false,
          platform: "bluesky",
          error: (errData == null ? void 0 : errData.message) || `HTTP ${response.status}`
        };
      }
      const data = await response.json();
      const ref = { uri: data.uri, cid: data.cid };
      if (!rootRef) {
        rootRef = ref;
        const rkey = data.uri.split("/").pop();
        firstPostUri = `https://bsky.app/profile/${creds.handle}/post/${rkey}`;
      }
      parentRef = ref;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, platform: "bluesky", error: msg };
    }
  }
  return { success: true, platform: "bluesky", url: firstPostUri };
}
const BLUESKY_CHAR_MAX = BLUESKY_CHAR_LIMIT;
const LW_GRAPHQL_URL = "https://www.lesswrong.com/graphql";
const BLOCK_REF_REGEX = /\(\(([\w\d-]{9,10})\)\)/g;
const PAGE_REF_REGEX = /\[\[([^\]]+)\]\]/g;
const HASHTAG_PAGE_REF_REGEX = /#\[\[([^\]]+)\]\]/g;
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^\s)]*)\)/g;
const ALIAS_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g;
const BUTTON_REGEX = /\{\{[^}]*\}\}/g;
function getCredentials(extensionAPI) {
  const loginToken = extensionAPI.settings.get("lesswrong-login-token");
  if (!loginToken) return null;
  return { loginToken };
}
function blockToHtml(raw) {
  if (!raw) return "";
  let text = raw;
  text = text.replace(IMAGE_REGEX, "");
  text = text.replace(BLOCK_REF_REGEX, (_, uid) => {
    try {
      const result = window.roamAlphaAPI.data.pull(
        "[:block/string]",
        [":block/uid", uid]
      );
      return (result == null ? void 0 : result[":block/string"]) || "";
    } catch {
      return "";
    }
  });
  text = text.replace(BUTTON_REGEX, "");
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  text = text.replace(ALIAS_REGEX, '<a href="$2">$1</a>');
  text = text.replace(HASHTAG_PAGE_REF_REGEX, (_, pageName) => pageName);
  text = text.replace(PAGE_REF_REGEX, (_, pageName) => pageName);
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__(.+?)__/g, "<em>$1</em>");
  text = text.replace(/\^\^(.+?)\^\^/g, "<mark>$1</mark>");
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(
    new RegExp('(?<!href=")(https?:\\/\\/[^\\s<]+)', "g"),
    '<a href="$1">$1</a>'
  );
  return text.trim();
}
function blocksToHtml(blocks) {
  return blocks.map((b) => `<p>${blockToHtml(b.text)}</p>`).join("\n");
}
function isLessWrongConfigured(extensionAPI) {
  return getCredentials(extensionAPI) !== null;
}
async function postToLessWrong(content, extensionAPI) {
  var _a2, _b, _c, _d;
  const creds = getCredentials(extensionAPI);
  if (!creds) {
    return { success: false, platform: "lesswrong", error: "LessWrong login token not configured" };
  }
  const corsProxy = getCorsProxyUrl();
  const html = blocksToHtml(content.blocks);
  const mutation = `
    mutation CreateComment($data: CreateCommentDataInput!) {
      createComment(data: $data) {
        data {
          _id
          postId
          user {
            slug
          }
        }
      }
    }
  `;
  const variables = {
    data: {
      shortform: true,
      shortformFrontpage: true,
      contents: {
        originalContents: {
          type: "html",
          data: html
        }
      }
    }
  };
  try {
    const response = await fetch(`${corsProxy}/${LW_GRAPHQL_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        loginToken: creds.loginToken
      },
      body: JSON.stringify({ query: mutation, variables })
    });
    if (!response.ok) {
      return {
        success: false,
        platform: "lesswrong",
        error: `HTTP ${response.status}`
      };
    }
    const result = await response.json();
    if ((_a2 = result.errors) == null ? void 0 : _a2.length) {
      return {
        success: false,
        platform: "lesswrong",
        error: result.errors.map((e) => e.message).join(", ")
      };
    }
    const commentData = (_c = (_b = result.data) == null ? void 0 : _b.createComment) == null ? void 0 : _c.data;
    const userSlug = (_d = commentData == null ? void 0 : commentData.user) == null ? void 0 : _d.slug;
    const url = userSlug ? `https://www.lesswrong.com/users/${userSlug}?tab=shortform` : void 0;
    return { success: true, platform: "lesswrong", url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "lesswrong", error: msg };
  }
}
const Blueprint = (_a = window.Blueprint) == null ? void 0 : _a.Core;
const { Button, Popover, Spinner, Icon, Tooltip, Checkbox } = Blueprint;
const PLATFORM_LABELS = {
  twitter: "X / Twitter",
  bluesky: "Bluesky",
  lesswrong: "LessWrong"
};
const PlatformIcon = ({ platform, size = 14 }) => {
  const icons = {
    twitter: "𝕏",
    bluesky: "🦋",
    lesswrong: "LW"
  };
  return /* @__PURE__ */ React.createElement("span", { style: { fontSize: size, fontWeight: "bold", marginRight: 4 } }, icons[platform]);
};
const ResultLine = ({ result }) => /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement(PlatformIcon, { platform: result.platform }), result.success ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Icon, { icon: "tick-circle", intent: "success", size: 14 }), result.url && /* @__PURE__ */ React.createElement("a", { href: result.url, target: "_blank", rel: "noopener noreferrer", style: { fontSize: 12 } }, "View post")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Icon, { icon: "error", intent: "danger", size: 14 }), /* @__PURE__ */ React.createElement("span", { style: { color: "red", fontSize: 12 } }, result.error)));
const PublishContent = ({ blockUid, extensionAPI, target, close }) => {
  const blocks = useMemo(() => getChildBlocks(blockUid), [blockUid]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    const set = /* @__PURE__ */ new Set();
    if (target === "all") {
      if (isTwitterConfigured(extensionAPI)) set.add("twitter");
      if (isBlueskyConfigured(extensionAPI)) set.add("bluesky");
      if (isLessWrongConfigured(extensionAPI)) set.add("lesswrong");
    } else {
      set.add(target);
    }
    return set;
  });
  const togglePlatform = useCallback((p) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);
  const validation = useMemo(() => {
    const errors = [];
    if (blocks.length === 0) {
      errors.push("No child blocks found. Add content as child blocks.");
    }
    if (selectedPlatforms.has("twitter")) {
      const v = validateTwitterThread(blocks);
      if (!v.valid) v.errors.forEach((e) => errors.push(`Twitter: ${e.reason}`));
    }
    if (selectedPlatforms.has("bluesky")) {
      const v = validateBlueskyThread(blocks);
      if (!v.valid) v.errors.forEach((e) => errors.push(`Bluesky: ${e.reason}`));
    }
    return { valid: errors.length === 0, errors };
  }, [blocks, selectedPlatforms]);
  const onPublish = useCallback(async () => {
    var _a2;
    setSending(true);
    setResults([]);
    const content = { blocks };
    const promises = [];
    if (selectedPlatforms.has("twitter")) promises.push(postToTwitter(content, extensionAPI));
    if (selectedPlatforms.has("bluesky")) promises.push(postToBluesky(content, extensionAPI));
    if (selectedPlatforms.has("lesswrong")) promises.push(postToLessWrong(content, extensionAPI));
    const settled = await Promise.allSettled(promises);
    const newResults = [];
    for (const r of settled) {
      if (r.status === "fulfilled") newResults.push(r.value);
      else newResults.push({ success: false, platform: "twitter", error: ((_a2 = r.reason) == null ? void 0 : _a2.message) || "Unknown error" });
    }
    setResults(newResults);
    setSending(false);
  }, [blocks, selectedPlatforms, extensionAPI]);
  const allConfigured = useMemo(() => {
    const platforms = [];
    if (isTwitterConfigured(extensionAPI)) platforms.push("twitter");
    if (isBlueskyConfigured(extensionAPI)) platforms.push("bluesky");
    if (isLessWrongConfigured(extensionAPI)) platforms.push("lesswrong");
    return platforms;
  }, [extensionAPI]);
  const allDone = results.length > 0 && !sending;
  const allSuccess = allDone && results.every((r) => r.success);
  return /* @__PURE__ */ React.createElement("div", { style: { padding: 16, maxWidth: 360, minWidth: 280 } }, allConfigured.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#888" } }, "No platforms configured. Open extension settings to add credentials.") : /* @__PURE__ */ React.createElement(React.Fragment, null, target === "all" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, marginBottom: 4, fontSize: 13 } }, "Publish to:"), allConfigured.map((p) => /* @__PURE__ */ React.createElement(
    Checkbox,
    {
      key: p,
      checked: selectedPlatforms.has(p),
      onChange: () => togglePlatform(p),
      label: /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement(PlatformIcon, { platform: p }), PLATFORM_LABELS[p]),
      style: { marginBottom: 2 }
    }
  ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8, fontSize: 12, color: "#666" } }, blocks.length, " block", blocks.length !== 1 ? "s" : "", " to publish", selectedPlatforms.has("twitter") && blocks.length > 0 && ` (thread of ${blocks.length} tweet${blocks.length !== 1 ? "s" : ""})`), !validation.valid && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8, padding: 8, background: "#fff3f3", borderRadius: 4, fontSize: 12 } }, validation.errors.map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { color: "red" } }, e))), !allDone && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement(
    Button,
    {
      intent: "primary",
      text: "Publish",
      onClick: onPublish,
      disabled: !validation.valid || sending || selectedPlatforms.size === 0
    }
  ), sending && /* @__PURE__ */ React.createElement(Spinner, { size: 20 })), results.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8 } }, results.map((r, i) => /* @__PURE__ */ React.createElement(ResultLine, { key: i, result: r })), allSuccess && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, color: "green", fontSize: 12 } }, "All posts published successfully!"))));
};
function getUidFromElement(el) {
  var _a2;
  const id = el.id || ((_a2 = el.closest(".roam-block")) == null ? void 0 : _a2.id) || "";
  return id.length >= 9 ? id.substring(id.length - 9) : "";
}
const PublishOverlay = ({ childrenRef, unmount, ...props }) => {
  const { blockUid, target } = props;
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const showTwitter = target === "all" || target === "twitter";
  const showBluesky = target === "all" || target === "bluesky";
  const charMax = showBluesky ? BLUESKY_CHAR_MAX : showTwitter ? TWITTER_CHAR_MAX : null;
  const calcCounts = useCallback(() => {
    return getChildBlocks(blockUid).map((b) => {
      const text = resolveBlockText(b.text);
      const count = showBluesky ? [...text].length : text.length;
      return { uid: b.uid, count };
    });
  }, [blockUid, showBluesky]);
  const calcBlockEls = useCallback(
    () => Array.from((childrenRef == null ? void 0 : childrenRef.children) || []).filter((c) => c.className.includes("roam-block-container")).map(
      (c) => Array.from(c.children).find(
        (c2) => c2.className.includes("rm-block-main")
      )
    ),
    [childrenRef]
  );
  const [counts, setCounts] = useState(calcCounts);
  const blockEls = useRef(calcBlockEls());
  const inputCallback = useCallback(
    (e) => {
      const target2 = e.target;
      if (target2.tagName === "TEXTAREA") {
        const textarea = target2;
        const currentUid = getUidFromElement(textarea);
        blockEls.current = calcBlockEls();
        setCounts(
          calcCounts().map((c) => {
            if (c.uid === currentUid) {
              const text = resolveBlockText(textarea.value);
              const count = showBluesky ? [...text].length : text.length;
              return { uid: currentUid, count };
            }
            return c;
          })
        );
      }
    },
    [calcCounts, calcBlockEls, showBluesky]
  );
  useEffect(() => {
    if (!childrenRef) return;
    childrenRef.addEventListener("input", inputCallback);
    return () => childrenRef.removeEventListener("input", inputCallback);
  }, [childrenRef, inputCallback]);
  useEffect(() => {
    blockEls.current = calcBlockEls();
    setCounts(calcCounts());
  }, [isOpen]);
  useEffect(() => {
    if (rootRef.current && !document.contains(rootRef.current.targetElement)) {
      unmount();
    }
  });
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const buttonLabel = target === "all" ? "📡" : target === "twitter" ? "𝕏" : target === "bluesky" ? "🦋" : "LW";
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    Popover,
    {
      target: /* @__PURE__ */ React.createElement(
        "span",
        {
          onClick: open,
          style: {
            cursor: "pointer",
            fontSize: 15,
            userSelect: "none"
          },
          title: `Publish to ${target === "all" ? "all platforms" : PLATFORM_LABELS[target]}`
        },
        buttonLabel
      ),
      content: /* @__PURE__ */ React.createElement(PublishContent, { ...props, close }),
      isOpen,
      onInteraction: (next) => setIsOpen(next),
      ref: rootRef
    }
  ), charMax && counts.map((c, i) => ({ ...c, el: blockEls.current[i] })).filter((c) => c.el).map(
    (c) => ReactDOM.createPortal(
      /* @__PURE__ */ React.createElement(
        "span",
        {
          className: "smp-char-count",
          style: {
            color: c.count > charMax ? "red" : "#999",
            fontSize: 11,
            marginLeft: 4
          }
        },
        c.count,
        "/",
        charMax
      ),
      c.el
    )
  ));
};
function renderPublishOverlay({
  parent,
  blockUid,
  extensionAPI,
  target
}) {
  const blockContainer = parent.closest(".roam-block-container");
  const childrenRef = blockContainer == null ? void 0 : blockContainer.querySelector(
    ":scope > .rm-block-children"
  );
  if (childrenRef) {
    Array.from(childrenRef.getElementsByClassName("smp-char-count")).forEach((s) => s.remove());
  }
  ReactDOM.render(
    /* @__PURE__ */ React.createElement(
      PublishOverlay,
      {
        blockUid,
        extensionAPI,
        target,
        childrenRef: childrenRef || void 0,
        unmount: () => ReactDOM.unmountComponentAtNode(parent)
      }
    ),
    parent
  );
}
const BUTTON_COMMANDS = [
  { command: "publish", target: "all" },
  { command: "tweet", target: "twitter" },
  { command: "bsky", target: "bluesky" },
  { command: "lesswrong", target: "lesswrong" }
];
const observers = [];
const styleEl = [];
function processButton(button, command, target, extensionAPI) {
  const blockContainer = button.closest(".roam-block-container");
  if (!blockContainer) return;
  const blockInput = blockContainer.querySelector(".rm-block__input");
  const roamBlock = button.closest(".roam-block");
  const idSource = (blockInput == null ? void 0 : blockInput.id) || (roamBlock == null ? void 0 : roamBlock.id) || "";
  if (idSource.length < 9) return;
  const blockUid = idSource.substring(idSource.length - 9);
  const parentEl = button.parentElement;
  if (!parentEl) return;
  if (parentEl.querySelector(`.smp-overlay-${command}`)) return;
  button.style.display = "none";
  const span = document.createElement("span");
  span.className = `smp-overlay-${command}`;
  parentEl.appendChild(span);
  renderPublishOverlay({ parent: span, blockUid, extensionAPI, target });
}
function createButtonObserver(command, target, extensionAPI) {
  const dataAttr = `data-smp-${command}`;
  const commandUpper = command.toUpperCase();
  const isMatch = (el) => el.nodeName === "BUTTON" && el.classList.contains("bp3-button") && el.innerText.toUpperCase() === commandUpper;
  const tryProcess = (el) => {
    if (!isMatch(el)) return;
    if (el.getAttribute(dataAttr)) return;
    el.setAttribute(dataAttr, "true");
    processButton(el, command, target, extensionAPI);
  };
  const scanChildren = (root) => {
    var _a2;
    const buttons = (_a2 = root.getElementsByClassName) == null ? void 0 : _a2.call(root, "bp3-button");
    if (!buttons) return;
    Array.from(buttons).filter((b) => b.nodeName === "BUTTON").forEach((b) => tryProcess(b));
  };
  scanChildren(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (isMatch(node)) {
          tryProcess(node);
        }
        scanChildren(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  observers.push(observer);
}
function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .smp-char-count {
      font-family: monospace;
      pointer-events: none;
    }
    .smp-overlay-publish,
    .smp-overlay-tweet,
    .smp-overlay-bsky,
    .smp-overlay-lesswrong {
      display: inline-block;
      vertical-align: middle;
    }
  `;
  document.head.appendChild(style);
  styleEl.push(style);
}
const index = {
  onload: ({ extensionAPI }) => {
    addStyles();
    extensionAPI.settings.panel.create({
      tabTitle: "Social Media Publisher",
      settings: [
        // Twitter
        {
          id: "twitter-api-key",
          name: "Twitter API Key",
          description: "Consumer API Key from X Developer Portal",
          action: { type: "input", placeholder: "API Key" }
        },
        {
          id: "twitter-api-secret",
          name: "Twitter API Secret",
          description: "Consumer API Secret",
          action: { type: "input", placeholder: "API Secret" }
        },
        {
          id: "twitter-access-token",
          name: "Twitter Access Token",
          description: "User Access Token from X Developer Portal",
          action: { type: "input", placeholder: "Access Token" }
        },
        {
          id: "twitter-access-token-secret",
          name: "Twitter Access Token Secret",
          description: "User Access Token Secret",
          action: { type: "input", placeholder: "Access Token Secret" }
        },
        // Bluesky
        {
          id: "bluesky-handle",
          name: "Bluesky Handle",
          description: "Your Bluesky handle (e.g., user.bsky.social)",
          action: { type: "input", placeholder: "user.bsky.social" }
        },
        {
          id: "bluesky-app-password",
          name: "Bluesky App Password",
          description: "App Password from Bluesky Settings > App Passwords",
          action: { type: "input", placeholder: "xxxx-xxxx-xxxx-xxxx" }
        },
        // LessWrong
        {
          id: "lesswrong-login-token",
          name: "LessWrong Login Token",
          description: "Login token from browser cookies (cookie name: loginToken)",
          action: { type: "input", placeholder: "Login Token" }
        }
      ]
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Social Media Publisher: Publish current block",
      callback: () => {
        const focused = window.roamAlphaAPI.ui.getFocusedBlock();
        if (!focused) return;
        const blockUid = focused["block-uid"];
        const blockEl = document.querySelector(`[id$="${blockUid}"]`);
        if (!blockEl) return;
        const mainEl = blockEl.closest(".rm-block-main") || blockEl;
        let overlay = mainEl.querySelector(".smp-overlay-publish");
        if (!overlay) {
          overlay = document.createElement("span");
          overlay.className = "smp-overlay-publish";
          mainEl.appendChild(overlay);
        }
        renderPublishOverlay({
          parent: overlay,
          blockUid,
          extensionAPI,
          target: "all"
        });
      }
    });
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Publish to Social Media",
      callback: (context) => {
        const blockUid = context["block-uid"];
        const blockEl = document.querySelector(`[id$="${blockUid}"]`);
        if (!blockEl) return;
        const mainEl = blockEl.closest(".rm-block-main") || blockEl;
        let overlay = mainEl.querySelector(".smp-overlay-publish");
        if (!overlay) {
          overlay = document.createElement("span");
          overlay.className = "smp-overlay-publish";
          mainEl.appendChild(overlay);
        }
        renderPublishOverlay({
          parent: overlay,
          blockUid,
          extensionAPI,
          target: "all"
        });
      }
    });
    for (const { command, target } of BUTTON_COMMANDS) {
      createButtonObserver(command, target, extensionAPI);
    }
  },
  onunload: () => {
    var _a2, _b, _c, _d;
    observers.forEach((o) => o.disconnect());
    observers.length = 0;
    styleEl.forEach((s) => s.remove());
    styleEl.length = 0;
    (_b = (_a2 = window.roamAlphaAPI.ui.commandPalette) == null ? void 0 : _a2.removeCommand) == null ? void 0 : _b.call(_a2, {
      label: "Social Media Publisher: Publish current block"
    });
    (_d = (_c = window.roamAlphaAPI.ui.blockContextMenu) == null ? void 0 : _c.removeCommand) == null ? void 0 : _d.call(_c, {
      label: "Publish to Social Media"
    });
    document.querySelectorAll('[class^="smp-overlay"]').forEach((el) => {
      var _a3;
      try {
        (_a3 = window.ReactDOM) == null ? void 0 : _a3.unmountComponentAtNode(el);
      } catch {
      }
      el.remove();
    });
  }
};
export {
  index as default
};
//# sourceMappingURL=extension.js.map
