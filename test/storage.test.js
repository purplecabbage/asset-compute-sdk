/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 *
 *  Copyright 2019 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 *  NOTICE:  All information contained herein is, and remains
 *  the property of Adobe Systems Incorporated and its suppliers,
 *  if any.  The intellectual and technical concepts contained
 *  herein are proprietary to Adobe Systems Incorporated and its
 *  suppliers and are protected by trade secret or copyright law.
 *  Dissemination of this information or reproduction of this material
 *  is strictly forbidden unless prior written permission is obtained
 *  from Adobe Systems Incorporated.
 */

 /* eslint-env mocha */
/* eslint mocha/no-mocha-arrows: "off" */

'use strict';

const {getSource, putRendition} = require('../lib/storage');
const mockFs = require('mock-fs');
const nock = require('nock');
const assert = require('assert');
const fs = require('fs-extra');
const { GenericError } = require('@nui/asset-compute-commons');


describe('storage.js', () => {
	describe('getSource', () => {

		beforeEach(() => {
			mockFs();
		})

		afterEach( () => {
			nock.cleanAll();
			mockFs.restore();
			delete process.env.NUI_UNIT_TEST_MODE;
			delete process.env.NUI_DISABLE_RETRIES;
		})
		it('should download simple png and return a new source object', async () => {
			const paramsSource = {
				url: 'https://example.com/photo/elephant.png'
			};
			const inDirectory = './in/fakeSource/filePath';

			mockFs({ './in/fakeSource/filePath': {} });
			assert.ok(fs.existsSync(inDirectory));

			nock('https://example.com')
                .get('/photo/elephant.png')
                .reply(200, 'ok')

			const source = await getSource(paramsSource, inDirectory)

			assert.equal(source.name, 'source.png');
			assert.equal(source.path, 'in/fakeSource/filePath/source.png');
			assert.ok(nock.isDone());
		})

		it('should fail during download', async () => {
			process.env.NUI_DISABLE_RETRIES = true // disable retries to test upload failure
			const paramsSource = {
				url: 'https://example.com/photo/elephant.png'
			};
			const inDirectory = './in/fakeSource/filePath';

			mockFs({ './in/fakeSource/filePath': {} });
			assert.ok(fs.existsSync(inDirectory));

			nock('https://example.com')
                .get('/photo/elephant.png')
                .reply(404, 'ok')

			let threw = false;
			try {
				await getSource(paramsSource, inDirectory)
			} catch (e) {
				console.log(e)
				assert.ok(e instanceof GenericError);
				assert.equal(e.message, "GET 'https://example.com/photo/elephant.png' failed with status 404");
				threw = true;
			}
			assert.ok(threw);
		})

		it('should fail because invalid url', async () => {
			const paramsSource = {
				url: 'http://example.com/photo/elephant.png'
			};
			const inDirectory = './in/fakeSource/filePath';

			mockFs({ './in/fakeSource/filePath': {} });

			let threw = false;
			try {
				await getSource(paramsSource, inDirectory)
			} catch (e) {
				assert.equal(e.message, 'Invalid Https Url: http://example.com/photo/elephant.png');
				threw = true;
			}
			assert.ok(threw);
		})

		it('should not download a file in unittest mode', async () => {
			process.env.NUI_UNIT_TEST_MODE = true;
			const paramsSource = {
				url: 'file.jpg'
			};
			const inDirectory = '/in';

			mockFs({ '/in/file.jpg': 'yo' });

			const source = await getSource(paramsSource, inDirectory)

			assert.equal(source.name, 'file.jpg'); // in this case source name is actual file path
			assert.equal(source.path, '/in/file.jpg');
		})

		it('should fail because of invalid localfile in unittest mode', async () => {
			process.env.NUI_UNIT_TEST_MODE = true;
			const paramsSource = {
				url: 'file/../../../../evilcode/elephant.jpg'
			};
			const inDirectory = '/in';
			let threw = false;
			try {
				await getSource(paramsSource, inDirectory)
			} catch (e) {
				assert.equal(e.message, 'Invalid or missing local file: file/../../../../evilcode/elephant.jpg')
				threw = true;
			}
			assert.ok(threw);
		})

		it('should fail because of missing localfile in unittest mode', async () => {
			process.env.NUI_UNIT_TEST_MODE = true;
			const paramsSource = {
				url: 'elephant.jpg'
			};
			const inDirectory = '/in';
			let threw = false;
			try {
				await getSource(paramsSource, inDirectory)
			} catch (e) {
				assert.equal(e.message, 'Invalid or missing local file: elephant.jpg')
				threw = true;
			}
			assert.ok(threw);
		})
	})

	describe('putRendition', () => {

		beforeEach(() => {
			mockFs();
		})

		afterEach( () => {
			nock.cleanAll();
			mockFs.restore();
			delete process.env.NUI_UNIT_TEST_MODE;
			delete process.env.NUI_DISABLE_RETRIES;
		})

		it('should upload simple rendition', async () => {
			mockFs({ "./storeFiles/jpg": {
                "fakeEarth.jpg": "hello world!"
            } });
            const file = "./storeFiles/jpg/fakeEarth.jpg";

            const rendition = {
                path: file,
                target: "https://example.com/fakeEarth.jpg"
            };

            nock("https://example.com")
                .put("/fakeEarth.jpg", "hello world!")
                .reply(200)

            assert.ok(fs.existsSync(file));
            await putRendition(rendition);
            assert.ok(nock.isDone());

		})

		it('should fail on upload because of an invalid url', async () => {
			mockFs({ "./storeFiles/jpg": {
                "fakeEarth.jpg": "hello world!"
            } });
            const file = "./storeFiles/jpg/fakeEarth.jpg";

            const rendition = {
                path: file,
                target: "http://example.com/fakeEarth.jpg"
            };

            let threw = false;
			try {
				await putRendition(rendition);
			} catch (e) {
				assert.equal(e.message, 'Invalid Https Url: http://example.com/fakeEarth.jpg');
				assert.ok(e instanceof GenericError);
				threw = true;
			}
			assert.ok(threw);
		})

		it('should fail on upload because of one invalid url for multipart upload', async () => {
			mockFs({ "./storeFiles/jpg": {
                "fakeEarth.jpg": "hello world!"
            } });
            const file = "./storeFiles/jpg/fakeEarth.jpg";

            const rendition = {
                path: file,
                target: {
					urls: ["https://example.com/fakeEarth.jpg", "https://example2.com/fakeEarth.jpg", "http://example.com/fakeEarth.jpg"]
				}
            };

            let threw = false;
			try {
				await putRendition(rendition);
			} catch (e) {
				assert.equal(e.message, 'Invalid or Missing Url ');
				assert.ok(e instanceof GenericError);
				threw = true;
			}
			assert.ok(threw);
		})

		it('should fail on upload because of a missing url', async () => {
			mockFs({ "./storeFiles/jpg": {
                "fakeEarth.jpg": "hello world!"
            } });
            const file = "./storeFiles/jpg/fakeEarth.jpg";

            const rendition = {
                path: file,
                target: undefined
            };

            let threw = false;
			try {
				await putRendition(rendition);
			} catch (e) {
				assert.equal(e.message, 'Invalid or Missing Url ');
				assert.ok(e instanceof GenericError);
				threw = true;
			}
			assert.ok(threw);
		})

		it('should fail on upload because of an invalid url for upload', async () => {
			mockFs({ "./storeFiles/jpg": {
                "fakeEarth.jpg": "hello world!"
            } });
            const file = "./storeFiles/jpg/fakeEarth.jpg";

            const rendition = {
                path: file,
                target: '../../hello.com'
            };

            let threw = false;
			try {
				await putRendition(rendition);
			} catch (e) {
				assert.equal(e.message, 'Invalid or Missing Url ../../hello.com');
				assert.ok(e instanceof GenericError);
				threw = true;
			}
			assert.ok(threw);
		})
	})
})