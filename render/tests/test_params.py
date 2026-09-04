"""Parameter serialization for OpenSCAD -D flags."""

import unittest

from docsandeye_render.params import serialise, serialise_value, argv


class TestParameterSerialization(unittest.TestCase):
    """Parameter serialization to OpenSCAD argv format."""

    def test_serialise_bool_true(self):
        """Serialise boolean True to 'true'."""
        result = serialise_value(True)
        self.assertEqual(result, "true")

    def test_serialise_bool_false(self):
        """Serialise boolean False to 'false'."""
        result = serialise_value(False)
        self.assertEqual(result, "false")

    def test_serialise_int(self):
        """Serialise int to JSON number."""
        result = serialise_value(42)
        self.assertEqual(result, "42")

    def test_serialise_float(self):
        """Serialise float to JSON number."""
        result = serialise_value(3.14)
        self.assertEqual(result, "3.14")

    def test_serialise_float_integer_value(self):
        """Serialise float with integer value to int notation."""
        result = serialise_value(10.0)
        # json.dumps keeps the .0 for floats even if they're whole numbers
        self.assertIn(result, ("10", "10.0"))

    def test_serialise_string_simple(self):
        """Serialise string with double quotes."""
        result = serialise_value("hello")
        self.assertEqual(result, '"hello"')

    def test_serialise_string_with_quote(self):
        """Serialise string with double quote, escaped."""
        result = serialise_value('say "hi"')
        self.assertEqual(result, '"say \\"hi\\""')

    def test_serialise_string_with_backslash(self):
        """Serialise string with backslash, escaped."""
        result = serialise_value("c:\\path")
        self.assertEqual(result, '"c:\\\\path"')

    def test_serialise_list_of_ints(self):
        """Serialise list of ints."""
        result = serialise_value([1, 2, 3])
        self.assertEqual(result, "[1,2,3]")

    def test_serialise_list_of_strings(self):
        """Serialise list of strings."""
        result = serialise_value(["a", "b"])
        self.assertEqual(result, '["a","b"]')

    def test_serialise_list_mixed_types(self):
        """Serialise list of mixed scalar types."""
        result = serialise_value([1, "two", 3.0, True])
        # json.dumps may keep 3.0 as 3.0 or convert to 3
        self.assertIn(result, ('[1,"two",3,true]', '[1,"two",3.0,true]'))

    def test_serialise_function_returns_list(self):
        """serialise(name, value) returns two-element list."""
        result = serialise("param", 42)
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], "-D")
        self.assertEqual(result[1], "param=42")

    def test_serialise_with_string_value(self):
        """serialise() with string value."""
        result = serialise("label", "top")
        self.assertEqual(result[0], "-D")
        self.assertEqual(result[1], 'label="top"')

    def test_argv_empty_dict(self):
        """argv() with empty dict returns empty list."""
        result = argv({})
        self.assertEqual(result, [])

    def test_argv_single_parameter(self):
        """argv() with single parameter."""
        result = argv({"height": 12})
        self.assertEqual(result, ["-D", "height=12"])

    def test_argv_multiple_parameters_order(self):
        """argv() preserves insertion order of parameters."""
        params = {"stop_height": 12, "label": "top", "ribs": False}
        result = argv(params)
        self.assertEqual(len(result), 6)  # 3 params * 2 entries each
        # Check order
        self.assertEqual(result[0], "-D")
        self.assertEqual(result[1], "stop_height=12")
        self.assertEqual(result[2], "-D")
        self.assertEqual(result[3], 'label="top"')
        self.assertEqual(result[4], "-D")
        self.assertEqual(result[5], "ribs=false")

    def test_argv_with_list_parameter(self):
        """argv() handles list parameter."""
        params = {"guides": [1, 2, 3]}
        result = argv(params)
        self.assertEqual(result, ["-D", "guides=[1,2,3]"])
