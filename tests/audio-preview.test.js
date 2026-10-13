'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validWavHeader}=require('../public/audio-preview');
const bytes=value=>new TextEncoder().encode(value).buffer;
test('WAV preview recognizes RIFF/WAVE audio containers',()=>{
  assert.equal(validWavHeader(bytes('RIFFxxxxWAVEfmt example')),true);
});
test('WAV preview refuses renamed non-audio files, unsupported containers and truncated headers',()=>{
  for(const input of [bytes('not a WAV file'),bytes('ID3xxxxxaudio'),bytes('RIFF'),bytes('RIFFxxxxAVI '),null,undefined,new Uint8Array(12)])assert.equal(validWavHeader(input),false);
});
