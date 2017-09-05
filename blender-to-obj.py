import bpy
import sys

argv = sys.argv
# Get all args after `--`
argv = argv[argv.index('--') + 1:]

objFilePath = argv[0]

bpy.ops.export_scene.obj(
    filepath=objFilePath,
    axis_forward="-Z",
    axis_up="Y",
    use_materials=False,
    use_triangles=True,
    use_edges=True,
    use_normals=True,
    use_mesh_modifiers=True,
    use_blen_objects=True
)
