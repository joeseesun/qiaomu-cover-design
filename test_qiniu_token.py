#!/usr/bin/env python3
import json
import hmac
import hashlib
import base64
import time

# 七牛云配置
ACCESS_KEY = 'p5en81L6k53PkgCQywYK9vX9BJLnJqrtmvBXkFaW'
SECRET_KEY = 'qV4m6r47s9okI7PEjCyrG6xMKtr9hmJMz1z4ZHEk'
BUCKET = 'joemarkdown'

def urlsafe_base64_encode(data):
    """URL 安全的 Base64 编码"""
    if isinstance(data, str):
        data = data.encode('utf-8')
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def generate_upload_token(bucket, key=None):
    """生成上传 Token"""
    # 1. 构造上传策略
    put_policy = {
        'scope': f'{bucket}:{key}' if key else bucket,
        'deadline': int(time.time()) + 3600,
    }
    
    # 2. JSON 序列化
    policy_str = json.dumps(put_policy, separators=(',', ':'))
    print(f'1. policy_str: {policy_str}')
    
    # 3. Base64 编码（URL 安全）
    encoded_put_policy = urlsafe_base64_encode(policy_str)
    print(f'2. encoded_put_policy: {encoded_put_policy}')
    
    # 4. HMAC-SHA1 签名
    sign = hmac.new(
        SECRET_KEY.encode('utf-8'),
        encoded_put_policy.encode('utf-8'),
        hashlib.sha1
    ).digest()
    print(f'3. sign (hex): {sign.hex()}')
    
    # 5. 签名 Base64 编码（URL 安全）
    encoded_sign = urlsafe_base64_encode(sign)
    print(f'4. encoded_sign: {encoded_sign}')
    
    # 6. 拼接 Token
    upload_token = f'{ACCESS_KEY}:{encoded_sign}:{encoded_put_policy}'
    print(f'5. upload_token: {upload_token[:100]}...')
    
    return upload_token

if __name__ == '__main__':
    # 测试生成 Token
    key = 'test-image.png'
    token = generate_upload_token(BUCKET, key)
    print(f'\n完整 Token:\n{token}')
    
    # 测试上传
    print('\n\n测试上传...')
    import requests
    
    files = {'file': ('test.txt', b'test content', 'text/plain')}
    data = {
        'token': token,
        'key': key,
    }
    
    response = requests.post('https://up.qiniup.com', files=files, data=data)
    print(f'Status: {response.status_code}')
    print(f'Response: {response.text}')

