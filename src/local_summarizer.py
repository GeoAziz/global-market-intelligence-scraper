#!/usr/bin/env python3
"""
Lightweight local summarizer using Hugging Face transformers.

Input (stdin): JSON object {"texts": ["...", ...], "max_length": 150}
Output (stdout): JSON object {"summaries": ["...", ...]}

Notes:
- This script is optional. Install Python dependencies to enable:
  pip install transformers torch
- For quantized 4-bit inference (best on limited VRAM), install bitsandbytes and a compatible setup.
  pip install bitsandbytes accelerate

This script will attempt CPU if no GPU is available.
"""
import sys
import json
import traceback

def main():
    try:
        data = json.load(sys.stdin)
        texts = data.get('texts', [])
        max_length = data.get('max_length', 150)
        if not texts:
            print(json.dumps({'summaries': []}))
            return

        # Lazy import to avoid heavy import when not used
        try:
            from transformers import pipeline
        except Exception as e:
            print(json.dumps({'error': 'transformers not available: ' + str(e)}))
            return

        device = 0 if __has_cuda() else -1
        summarizer = pipeline('summarization', model='facebook/bart-large-cnn', device=device)

        summaries = []
        for t in texts:
            out = summarizer(t, max_length=max_length, min_length=20, do_sample=False)
            if isinstance(out, list) and out and 'summary_text' in out[0]:
                summaries.append(out[0]['summary_text'])
            elif isinstance(out, dict) and 'summary_text' in out:
                summaries.append(out['summary_text'])
            else:
                summaries.append('')

        print(json.dumps({'summaries': summaries}))
    except Exception:
        tb = traceback.format_exc()
        print(json.dumps({'error': 'exception', 'trace': tb}))

def __has_cuda():
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False

if __name__ == '__main__':
    main()
