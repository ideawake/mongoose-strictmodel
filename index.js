/**
 * @module strictModelPlugin
 */


/**
 * When projection/selection options are not specified, this plugin forces Mongoose to only return fields that were
 * specified on the model the query is called on.  AKA Fields in MongoDB but not in the Model are not returned.
 * @memberof module:strictModelPlugin
 * @param {Schema} Schema - Mongoose Schema object
 * @param {object} [options] - Options object to configure plugin behavior
 * @returns {Schema}
 */
module.exports = function StrictModelPlugin(Schema, options) {

    // Setup options
    var opts = options || {};
    var allowNonModelQueryParameters = !!opts.allowNonModelQueryParameters;
    var allowNonModelSelectionParameters = !!opts.allowNonModelSelectionParameters;

    /**
     * Holds all the model's fields (paths)
     * @type {Array}
     */
    var paths = [];
    Schema.eachPath(function(pathName, schemaType) {
        paths.push(pathName);
    });

    /* Attach function to every available pre hook. */
    Schema.pre('count', function(next) { restrictSelect(this, next); });
    Schema.pre('find', function(next) { restrictSelect(this, next); });
    Schema.pre('findOne', function(next) { restrictSelect(this, next); });
    Schema.pre('findOneAndRemove', function(next) { restrictSelect(this, next); });
    Schema.pre('findOneAndUpdate', function(next) { restrictSelect(this, next); });
    Schema.pre('update', function(next) { restrictSelect(this, next); });

    function restrictSelect(query, next) {

        //==================================================================
        //
        //               CHECK QUERY PARAMETERS FOR FIELDS NOT IN MODEL
        //
        //==================================================================
        if (!allowNonModelQueryParameters) {
            var queryConditions = query.getQuery();
            var queryFields = Object.keys(queryConditions);

            // Go through each query field and see if it is in the Mongoose model's Schema
            for (var queryFieldIndex = 0; queryFieldIndex < queryFields.length; queryFieldIndex += 1) {
                var queryField = queryFields[ queryFieldIndex ];

                if (paths.indexOf(queryField) === -1) {
                    throw new Error('Attempting to query on a field that is not listed in Mongoose model: ' + queryField);
                }
            }
        }


        //================================================================
        //
        //               CHECK PROJECTION FOR FIELDS NOT IN MODEL
        //
        //================================================================

        var projectionFieldMap = query._fields || {};
        var projectionFields = Object.keys(projectionFieldMap);
        var numSelectedPathIndexes = projectionFields.length;
        var newSelectQuery = {};

        // If there are no fields selected, select all of the model's fields
        if (numSelectedPathIndexes === 0) {
            query.select(paths.join(' '));
            return next();
        }
        else if (query._fields[ projectionFields[ 0 ] ] === 1) { // Query was Inclusion Projection

            // Go through each requested field and only include paths in Schema in new select query
            for (var projFieldIndex = 0; projFieldIndex < projectionFields.length; projFieldIndex += 1) {
                var projField = projectionFields[ projFieldIndex ];

                if (paths.indexOf(projField) > -1) {
                    newSelectQuery[ projField ] = 1;
                }
                else if (!allowNonModelSelectionParameters) {
                    throw new Error('Attempting to project on a field that is not listed in Mongoose model');
                }
            }

            query._fields = newSelectQuery;
            return next();

        }
        else { // Query was Exclusion Projection

            // Iterate through Schema paths and add all but the excluded ones to new select query
            for (var pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
                var path = paths[ pathIndex ];

                // If this path wasn't excluded by select parameters, add to new query
                if (projectionFieldMap[ path ] !== 0) {
                    newSelectQuery[ path ] = 1;
                }
            }

            if (Object.keys(newSelectQuery).length !== (paths.length - projectionFields.length) && !allowNonModelSelectionParameters) {
                throw new Error('Attempting to project on a field that is not listed in Mongoose model.');
            }

            query._fields = newSelectQuery;
            return next();
        }
    }

    return Schema;

};