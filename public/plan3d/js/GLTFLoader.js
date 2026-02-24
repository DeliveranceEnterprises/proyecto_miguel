/**
 * THREE.GLTFLoader - Compatible con THREE.js r69
 * Soporta el formato binario GLB (glTF 2.0)
 * Desarrollado para Blueprint3D con Three.js r69
 */
(function () {

    'use strict';

    THREE.GLTFLoader = function (manager) {
        this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
    };

    THREE.GLTFLoader.prototype = {

        constructor: THREE.GLTFLoader,

        load: function (url, onLoad, onProgress, onError) {
            var scope = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onload = function () {
                if (xhr.status === 200 || xhr.status === 0) {
                    try {
                        scope.parse(xhr.response, function (gltf) {
                            onLoad(gltf);
                        });
                    } catch (e) {
                        if (onError) onError(e);
                        else throw e;
                    }
                } else {
                    if (onError) onError('HTTP ' + xhr.status + ' loading: ' + url);
                }
            };

            xhr.onprogress = onProgress || null;
            xhr.onerror = function (e) {
                if (onError) onError(e);
            };

            xhr.send(null);
        },

        parse: function (data, onLoad) {
            var magic = new Uint32Array(data, 0, 1)[0];

            if (magic !== 0x46546C67) {
                // No es GLB, intentar como JSON
                try {
                    var text = THREE.LoaderUtils
                        ? THREE.LoaderUtils.decodeText(new Uint8Array(data))
                        : String.fromCharCode.apply(null, new Uint8Array(data));
                    var json = JSON.parse(text);
                    this._parseGLTF(json, null, onLoad);
                } catch (e) {
                    console.error('GLTFLoader: No es GLB ni JSON válido', e);
                }
                return;
            }

            // Cabecera GLB
            var header = new Uint32Array(data, 0, 3);
            // header[0] = magic, header[1] = version, header[2] = length
            var totalLength = header[2];

            var jsonChunk = null;
            var binChunk = null;
            var offset = 12;

            while (offset < totalLength) {
                var chunkHeader = new Uint32Array(data, offset, 2);
                var chunkLength = chunkHeader[0];
                var chunkType = chunkHeader[1];
                offset += 8;

                if (chunkType === 0x4E4F534A) {
                    // Chunk JSON
                    var jsonBytes = new Uint8Array(data, offset, chunkLength);
                    var jsonString = '';
                    for (var i = 0; i < jsonBytes.length; i++) {
                        jsonString += String.fromCharCode(jsonBytes[i]);
                    }
                    jsonChunk = JSON.parse(jsonString);
                } else if (chunkType === 0x004E4942) {
                    // Chunk BIN
                    binChunk = data.slice(offset, offset + chunkLength);
                }

                offset += chunkLength;
            }

            if (!jsonChunk) {
                console.error('GLTFLoader: No se encontró chunk JSON en el GLB');
                return;
            }

            this._parseGLTF(jsonChunk, binChunk, onLoad);
        },

        // ---------------------------------------------------------------
        // Lector de accessors
        // ---------------------------------------------------------------
        _getAccessorData: function (gltf, binChunk, accessorIndex) {
            var accessor = gltf.accessors[accessorIndex];
            var bufferView = gltf.bufferViews[accessor.bufferView];

            var byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
            var count = accessor.count;

            // componentType: 5126=Float32, 5123=Uint16, 5125=Uint32, 5121=Uint8
            var componentType = accessor.componentType;
            var type = accessor.type; // SCALAR, VEC2, VEC3, VEC4, MAT4

            var numComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type] || 1;

            var buffer;
            // El buffer[0] es el chunk BIN en GLB
            if (binChunk) {
                buffer = binChunk;
            } else {
                // GLTF externo - no soportado en esta versión mínima
                console.warn('GLTFLoader: buffers externos no soportados');
                return null;
            }

            var stride = bufferView.byteStride || (numComponents * this._componentSize(componentType));
            var result;

            if (componentType === 5126) {
                // Float32
                if (stride === numComponents * 4) {
                    result = new Float32Array(buffer, byteOffset, count * numComponents);
                } else {
                    // Con stride, hay que copiar
                    result = new Float32Array(count * numComponents);
                    var view = new DataView(buffer);
                    for (var i = 0; i < count; i++) {
                        for (var j = 0; j < numComponents; j++) {
                            result[i * numComponents + j] = view.getFloat32(byteOffset + i * stride + j * 4, true);
                        }
                    }
                }
            } else if (componentType === 5123) {
                // Uint16
                result = new Uint16Array(buffer, byteOffset, count * numComponents);
            } else if (componentType === 5125) {
                // Uint32
                result = new Uint32Array(buffer, byteOffset, count * numComponents);
            } else if (componentType === 5121) {
                // Uint8
                result = new Uint8Array(buffer, byteOffset, count * numComponents);
            } else {
                console.warn('GLTFLoader: componentType no soportado:', componentType);
                return null;
            }

            return result;
        },

        _componentSize: function (componentType) {
            var sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
            return sizes[componentType] || 4;
        },

        // ---------------------------------------------------------------
        // Parseo principal
        // ---------------------------------------------------------------
        _parseGLTF: function (gltf, binChunk, onLoad) {
            var scope = this;
            var sceneRoot = new THREE.Object3D();

            // Qué escena cargar
            var sceneIndex = (gltf.scene !== undefined) ? gltf.scene : 0;
            var sceneDef = gltf.scenes && gltf.scenes[sceneIndex];

            if (!sceneDef) {
                console.warn('GLTFLoader: No hay definición de escena');
                onLoad({ scene: sceneRoot });
                return;
            }

            // Construir materiales
            var materials = scope._buildMaterials(gltf);

            // Construir mallas
            var meshObjects = scope._buildMeshes(gltf, binChunk, materials);

            // Construir nodos recursivamente
            function buildNode(nodeIndex) {
                var nodeDef = gltf.nodes[nodeIndex];
                var obj = new THREE.Object3D();

                if (nodeDef.name) obj.name = nodeDef.name;

                // Transformaciones
                if (nodeDef.matrix) {
                    var m = nodeDef.matrix;
                    obj.matrix.set(
                        m[0], m[4], m[8],  m[12],
                        m[1], m[5], m[9],  m[13],
                        m[2], m[6], m[10], m[14],
                        m[3], m[7], m[11], m[15]
                    );
                    obj.matrixAutoUpdate = false;
                } else {
                    if (nodeDef.translation) {
                        obj.position.set(nodeDef.translation[0], nodeDef.translation[1], nodeDef.translation[2]);
                    }
                    if (nodeDef.rotation) {
                        // quaternion
                        obj.quaternion.set(nodeDef.rotation[0], nodeDef.rotation[1], nodeDef.rotation[2], nodeDef.rotation[3]);
                    }
                    if (nodeDef.scale) {
                        obj.scale.set(nodeDef.scale[0], nodeDef.scale[1], nodeDef.scale[2]);
                    }
                }

                // Malla asociada
                if (nodeDef.mesh !== undefined && meshObjects[nodeDef.mesh]) {
                    var meshGroup = meshObjects[nodeDef.mesh];
                    obj.add(meshGroup);
                }

                // Hijos
                if (nodeDef.children) {
                    nodeDef.children.forEach(function (childIndex) {
                        obj.add(buildNode(childIndex));
                    });
                }

                return obj;
            }

            // Añadir nodos raíz de la escena
            if (sceneDef.nodes) {
                sceneDef.nodes.forEach(function (nodeIndex) {
                    sceneRoot.add(buildNode(nodeIndex));
                });
            }

            onLoad({ scene: sceneRoot });
        },

        // ---------------------------------------------------------------
        // Construir materiales desde gltf.materials[]
        // ---------------------------------------------------------------
        _buildMaterials: function (gltf) {
            var materials = [];
            if (!gltf.materials) return materials;

            gltf.materials.forEach(function (matDef) {
                var params = {
                    name: matDef.name || '',
                    side: THREE.FrontSide
                };

                // doubleSided
                if (matDef.doubleSided) params.side = THREE.DoubleSide;

                // Color base PBR → MeshPhongMaterial en r69
                var color = new THREE.Color(1, 1, 1);
                if (matDef.pbrMetallicRoughness) {
                    var pbr = matDef.pbrMetallicRoughness;
                    if (pbr.baseColorFactor) {
                        color.setRGB(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2]);
                    }
                }

                params.color = color;
                params.shininess = 30;

                var mat = new THREE.MeshPhongMaterial(params);
                materials.push(mat);
            });

            return materials;
        },

        // ---------------------------------------------------------------
        // Construir mallas
        // ---------------------------------------------------------------
        _buildMeshes: function (gltf, binChunk, materials) {
            var scope = this;
            var meshObjects = [];

            if (!gltf.meshes) return meshObjects;

            gltf.meshes.forEach(function (meshDef) {
                var group = new THREE.Object3D();
                group.name = meshDef.name || '';

                meshDef.primitives.forEach(function (primitive) {
                    var geometry = scope._buildGeometry(gltf, binChunk, primitive);
                    if (!geometry) return;

                    var material;
                    if (primitive.material !== undefined && materials[primitive.material]) {
                        material = materials[primitive.material];
                    } else {
                        material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 30 });
                    }

                    var mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                });

                meshObjects.push(group);
            });

            return meshObjects;
        },

        // ---------------------------------------------------------------
        // Construir geometría de una primitiva
        // ---------------------------------------------------------------
        _buildGeometry: function (gltf, binChunk, primitive) {
            var scope = this;
            var geometry = new THREE.BufferGeometry();

            var attributes = primitive.attributes;

            // POSITION
            if (attributes.POSITION !== undefined) {
                var positions = scope._getAccessorData(gltf, binChunk, attributes.POSITION);
                if (positions) {
                    // THREE.js r69 BufferAttribute
                    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
                }
            }

            // NORMAL
            if (attributes.NORMAL !== undefined) {
                var normals = scope._getAccessorData(gltf, binChunk, attributes.NORMAL);
                if (normals) {
                    geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
                }
            }

            // TEXCOORD_0 (UV)
            if (attributes.TEXCOORD_0 !== undefined) {
                var uvs = scope._getAccessorData(gltf, binChunk, attributes.TEXCOORD_0);
                if (uvs) {
                    geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
                }
            }

            // Índices (faces)
            if (primitive.indices !== undefined) {
                var indices = scope._getAccessorData(gltf, binChunk, primitive.indices);
                if (indices) {
                    // r69 usa setIndex con BufferAttribute
                    var indexArray;
                    if (indices instanceof Uint32Array) {
                        indexArray = new Uint32Array(indices);
                    } else {
                        indexArray = new Uint16Array(indices);
                    }
                    // En r69 se usa addAttribute para 'index' ó setIndex si existe
                    if (geometry.setIndex) {
                        geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
                    } else {
                        // Fallback r69
                        geometry.addAttribute('index', new THREE.BufferAttribute(indexArray, 1));
                    }
                }
            }

            // Computar bounding box y bounding sphere
            if (geometry.attributes.position) {
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();

                // Si no tiene normales, calcularlas
                if (!geometry.attributes.normal) {
                    try {
                        if (geometry.computeVertexNormals) {
                            geometry.computeVertexNormals();
                        }
                    } catch (e) {
                        // Ignorar si falla
                    }
                }
            }

            return geometry;
        }
    };

})();
