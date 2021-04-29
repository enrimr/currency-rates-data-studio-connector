// Copyright 2017 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Community Connector for npm package download count data. This
 * can retrieve download count for one or multiple packages from npm by date.
 *
 */

console.log("1");

var cc = DataStudioApp.createCommunityConnector();
var DEFAULT_CURRENCY = 'EUR';

// [START get_config]
// https://developers.google.com/datastudio/connector/reference#getconfig
function getConfig() {
  console.log("getConfig");
  var config = cc.getConfig();

  config
    .newInfo()
    .setId('instructions')
    .setText(
      'Enter currency name to fetch their rates. An invalid or blank entry will revert to the default value (EUR).'
    );

  config
    .newTextInput()
    .setId('currency')
    .setName(
      'Enter a currency name'
    )
    .setHelpText('e.g. "BTC" or "EUR"')
    .setPlaceholder(DEFAULT_CURRENCY)
    .setAllowOverride(true);

  config
    .newTextInput()
    .setId('apikey')
    .setName(
      'Enter your CoinAPI apiKey'
    )
    .setHelpText('Register into CoinAPI and get your personal apiKey')
    .setPlaceholder('CoinAPI apikey')
    .setAllowOverride(true);

  console.log(config);
  return config.build();
}
// [END get_config]

// [START get_schema]
function getFields() {
  console.log("getFields");
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;

  fields
    .newDimension()
    .setId('currency')
    .setName('Currency')
    .setType(types.TEXT);

  fields
    .newDimension()
    .setId('rate')
    .setName('Rate')
    .setType(types.NUMBER);

  return fields;
}

// https://developers.google.com/datastudio/connector/reference#getschema
function getSchema(request) {
  console.log("getSchema");
  return {schema: getFields().build()};
}
// [END get_schema]

// [START get_data]
// https://developers.google.com/datastudio/connector/reference#getdata
function getData(request) {
  console.log("getData");
  request.configParams = validateConfig(request.configParams);

  var requestedFields = getFields().forIds(
    request.fields.map(function(field) {
      return field.name;
    })
  );

  try {
    var apiResponse = fetchDataFromApi(request);
    console.log(apiResponse);
    var normalizedResponse = normalizeResponse(request, apiResponse);
    //var data = getFormattedData(normalizedResponse, requestedFields);
    var data = normalizedResponse;
    console.log(data);
  } catch (e) {
    cc.newUserError()
      .setDebugText('Error fetching data from API. Exception details: ' + e)
      .setText(
        'The connector has encountered an unrecoverable error. Please try again later, or file an issue if this error persists.'
      )
      .throwException();
  }

  var responseReturn = {
    schema: requestedFields.build(),
    rows: data
  };
  
  return responseReturn
}

/**
 * Gets response for UrlFetchApp.
 *
 * @param {Object} request Data request parameters.
 * @returns {string} Response text for UrlFetchApp.
 */
function fetchDataFromApi(request) {
  console.log("fetchDataFromApi");
  var url = [
    'https://rest.coinapi.io/v1/exchangerate/',
    'EUR',//request.configParams.currency,
    '?apikey=',
    request.configParams.apikey
  ].join('');
  var response = UrlFetchApp.fetch(url);
  console.log(response);
  return response;
}

/**
 * Parses response string into an object. Also standardizes the object structure
 * for single vs multiple packages.
 *
 * @param {Object} request Data request parameters.
 * @param {string} responseString Response from the API.
 * @return {Object} Contains package names as keys and associated download count
 *     information(object) as values.
 */
function normalizeResponse(request, responseString) {
  console.log("normalizeResponse");
  var response = JSON.parse(responseString);
  var rates = response.rates;
  var mappedRates = rates.map(element => {
    return {
      values: [element.asset_id_quote, element.rate]
    }
    /*return {
      currency: element.asset_id_quote,
      rate: element.rate
    }*/
  });
  return mappedRates;

  /*var package_list = request.configParams.package.split(',');
  var mapped_response = {};

  if (package_list.length == 1) {
    mapped_response[package_list[0]] = response;
  } else {
    mapped_response = response;
  }

  return mapped_response;*/
}

/**
 * Formats the parsed response from external data source into correct tabular
 * format and returns only the requestedFields
 *
 * @param {Object} parsedResponse The response string from external data source
 *     parsed into an object in a standard format.
 * @param {Array} requestedFields The fields requested in the getData request.
 * @returns {Array} Array containing rows of data in key-value pairs for each
 *     field.
 */
function getFormattedData(response, requestedFields) {
  var data = [];
  Object.keys(response).map(function(packageName) {
    var package = response[packageName];
    var downloadData = package.downloads;
    var formattedData = downloadData.map(function(dailyDownload) {
      return formatData(requestedFields, packageName, dailyDownload);
    });
    data = data.concat(formattedData);
  });
  return data;
}
// [END get_data]

// https://developers.google.com/datastudio/connector/reference#isadminuser
function isAdminUser() {
  var email = Session.getEffectiveUser().getEmail();
  return email === "enriquemendozarobaina@gmail.com";
}

/**
 * Validates config parameters and provides missing values.
 *
 * @param {Object} configParams Config parameters from `request`.
 * @returns {Object} Updated Config parameters.
 */
function validateConfig(configParams) {
  configParams = configParams || {};
  configParams.currency = configParams.currency || DEFAULT_CURRENCY;

  configParams.currency = configParams.currency.trim();;

  return configParams;
}

/**
 * Formats a single row of data into the required format.
 *
 * @param {Object} requestedFields Fields requested in the getData request.
 * @param {string} packageName Name of the package who's download data is being
 *    processed.
 * @param {Object} dailyDownload Contains the download data for a certain day.
 * @returns {Object} Contains values for requested fields in predefined format.
 */
/*function formatData(requestedFields, packageName, dailyDownload) {
  var row = requestedFields.asArray().map(function(requestedField) {
    switch (requestedField.getId()) {
      case 'day':
        return dailyDownload.day.replace(/-/g, '');
      case 'downloads':
        return dailyDownload.downloads;
      case 'packageName':
        return packageName;
      default:
        return '';
    }
  });
  return {values: row};
}*/

function formatData(requestedFields, currencyRate) {
  var row = requestedFields.asArray().map(function(requestedField) {
    switch (requestedField.getId()) {
      case 'currency':
        return currencyRate.asset_id_quote;
      case 'rate':
        return currencyRate.rate;
      default:
        return '';
    }
  });
  return {values: row};
}


