/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

const AssetComputeWorker = require('./worker');
const ShellScriptWorker = require('./shell/shellscript');
const actionWrapper = require('./webaction');
const { AssetComputeWorkerPipeline } = require('./worker-pipeline');

/**
 * Checks if at least rendition needs the pipeline.
 * If at least one rendition needs pipeline, all will go through pipeline
 * @param {*} params Params
 * @returns True is pipeline is needed, false otherwise
 */
function hasAtLeastOnePipelineRendtion(params){
    return params.renditions.some(rendition => {
        return rendition.pipeline === true;
    });
}

/**
 * Worker where the renditionCallback is called for each rendition.
 * One worker instantiates a pipeline, which executes one or more transformers in sequence
 *
 * @param {*} renditionCallback callback called for each rendition, must convert source into rendition
 *                              signature: (source, rendition)
 *                              required
 * @param {*} options optional options
 */
function worker(renditionCallback, options = {}) {
    if (typeof renditionCallback !== "function") {
        throw new Error("renditionCallback must be a function");
    }

    return actionWrapper(async function (params) {
        const usePipeline = hasAtLeastOnePipelineRendtion(params);
        if(usePipeline){
            // here the pipeline only wraps the worker callback
            // and other transformers potentially already available in a transformer catalog
            console.log("Using pipeline (`worker#AssetComputeWorkerPipeline #WorkerCallbackTransformer`)");
            return new AssetComputeWorkerPipeline(renditionCallback, options).compute(params);
        } else {
            console.log("Using worker callback (`worker#AssetComputeWorker`)");
            return new AssetComputeWorker(params, options).compute(renditionCallback);
        }
    });
}


/**
 * Worker where the renditionsCallback is called once with all renditions.
 *
 * @param {*} renditionsCallback callback called with all rendition, must convert source into all renditions
 *                               signature: (source, renditions)
 *                               required
 * @param {*} options optional options
 */
function batchWorker(renditionsCallback, options = {}) {
    if (typeof renditionsCallback !== "function") {
        throw new Error("renditionsCallback must be a function");
    }

    return actionWrapper(async function (params) {
        const usePipeline = hasAtLeastOnePipelineRendtion(params);
        if(usePipeline){
            // here the pipeline only wraps the worker callback
            // and other transformers potentially already available in a transformer catalog
            console.log("Using pipeline (`AssetComputeWorkerPipeline #BatchWorkerCallbackTransformer`)");
            options.isBatchWorker = true;
            return new AssetComputeWorkerPipeline(renditionsCallback, options).compute(params);
        } else {
            console.log("Using worker callback (`AssetComputeWorker`)");
            return new AssetComputeWorker(params, options).computeAllAtOnce(renditionsCallback);
        }
    });
}


function shellScriptWorker(script = "worker.sh", options = {}) {
    ShellScriptWorker.validate(script);
    options.script = script;

    return actionWrapper(function (params) {
        const usePipeline = hasAtLeastOnePipelineRendtion(params);
        if(usePipeline){
            console.log("Using pipeline (`AssetComputeWorkerPipeline #ShellscriptCallbackTransformer`)");
            if(!options.supportsPipeline) {
                throw new Error("This shellscript worker does not support running as part of pipelines");
            }

            options.isShellscriptWorker = true;
            options.params = params;
            if(process.env.ASSET_COMPUTE_SENSEI_CATALOG) {
                options.transformerCatalog = process.env.ASSET_COMPUTE_SENSEI_CATALOG;
            }

            return new AssetComputeWorkerPipeline(options.script, options).compute(params);
        } else {
            console.log("Using shellscript worker callback (`ShellScriptWorker`)");
            return new ShellScriptWorker(params, options).compute();
        }
    });
}

module.exports = {
    worker,
    batchWorker,
    shellScriptWorker
};
