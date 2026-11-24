"""Extract the existing V4 crate and its dependent resources without changing its geometry."""
import copy
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'public/assets/desert_hut_v4/desert_hut_v4.glb').read_bytes()
json_length = struct.unpack_from('<I', source, 12)[0]
original = json.loads(source[20:20 + json_length])
binary = source[28 + json_length:]
output = {'asset': original['asset'], 'scene': 0, 'scenes': [{'nodes': []}]}
indices = {}
chunks = bytearray()


def retain(kind, index):
    key = (kind, index)
    if key in indices:
        return indices[key]
    item = copy.deepcopy(original[kind][index])
    destination = output.setdefault(kind, [])
    indices[key] = len(destination)
    destination.append(item)
    if kind == 'nodes':
        if any(field in item for field in ('matrix', 'translation', 'rotation', 'scale', 'children')):
            raise ValueError('Crate extraction expects baked node transforms')
        item['mesh'] = retain('meshes', item['mesh'])
    elif kind == 'meshes':
        for primitive in item['primitives']:
            primitive['attributes'] = {name: retain('accessors', value) for name, value in primitive['attributes'].items()}
            primitive['indices'] = retain('accessors', primitive['indices'])
            primitive['material'] = retain('materials', primitive['material'])
    elif kind == 'accessors':
        if 'sparse' in item:
            raise ValueError('Sparse accessors are not supported by this asset extractor')
        item['bufferView'] = retain('bufferViews', item['bufferView'])
    elif kind == 'bufferViews':
        start = item.get('byteOffset', 0)
        chunks.extend(b'\0' * (-len(chunks) % 4))
        item['byteOffset'] = len(chunks)
        chunks.extend(binary[start:start + item['byteLength']])
        item['buffer'] = 0
    elif kind == 'materials':
        def textures(value):
            for name, data in value.items():
                if isinstance(data, dict):
                    if name.endswith('Texture') and 'index' in data:
                        data['index'] = retain('textures', data['index'])
                    else:
                        textures(data)
        textures(item)
    elif kind == 'textures':
        item['source'] = retain('images', item['source'])
        if 'sampler' in item:
            item['sampler'] = retain('samplers', item['sampler'])
    elif kind == 'images':
        item['bufferView'] = retain('bufferViews', item['bufferView'])
    return indices[key]


for index, node in enumerate(original['nodes']):
    if node.get('name', '').startswith('decorative_crate_'):
        output['scenes'][0]['nodes'].append(retain('nodes', index))
if len(output['scenes'][0]['nodes']) != 4:
    raise ValueError('Expected the four V4 crate meshes')
output['buffers'] = [{'byteLength': len(chunks)}]
encoded = json.dumps(output, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
chunks.extend(b'\0' * (-len(chunks) % 4))
result = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(chunks))
result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
result += struct.pack('<II', len(chunks), 0x004E4942) + chunks
(ROOT / 'public/assets/crate/desert_crate_v4.glb').write_bytes(result)
print(f'Extracted V4 crate: {len(result)} bytes')
