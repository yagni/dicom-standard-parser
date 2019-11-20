## Usage
Takes an optional list of IODs to include in the output. If none are provided, every IOD from part 3 of the standard is included:

`npx dicom-standard-parser "CT Image" "RT Structure Set"`

## Output

Outputs two files into the directory in which it's run:

### data-dictionary.json
JSON version of part 6 of the standard. One large object whose keys are tags and whose values are the keyword, VR, and VM columns from the standard.
```
{
    /* ... */
    "20000010": {
        "name" : "NumberOfCopies",
        "vr" : "IS",
        "vm" : "1"
    },
    /* ... */
}
```

### IODs.json
JSON version of part 3 of the standard. Consists of an object that has iods and modules
```
{
    "iods": {
        /* ... */
        "CT Image" : {
            "name" : "CT Image",
            "modules" : [
                { "name" : "Patient", "usage" : "M" },
                { "name" : "Clinical Trial Subject", "usage" : "U" },
                /* ... */
                { "name" : "Common Instance Reference", "usage" : "U" }
            ]
        },
        /* ... */
    },
    "modules": {
        "Device" : [ 
            { 
                "tag":"00500010",
                "type":"1",
                "vr":"SQ",
                "vm":"1",
                "itemCount":{ 
                    "min":1
                },
                "itemAttributes":[ 
                    { 
                        "tag":"00080100",
                        "type":"1C",
                        "vr":"SH",
                        "vm":"1"
                    },
                    /* ... */
                    { 
                        "tag":"00080121",
                        "type":"3",
                        "vr":"SQ",
                        "vm":"1",
                        "itemCount":{ 
                            "min":1
                        },
                        "itemAttributes":[ 
                            { 
                                "tag":"00080100",
                                "type":"1C",
                                "vr":"SH",
                                "vm":"1"
                            },
                            /* ... */
                        ]
                    },
                    { 
                        "tag":"00080105",
                        "type":"1C",
                        "vr":"CS",
                        "vm":"1",
                        "definedTerms":[ 
                            "DCMR",
                            "SDM"
                        ]
                    },
                    /* ... */
                    { 
                        "tag":"00500020",
                        "type":"3",
                        "vr":"LO",
                        "vm":"1"
                    }
                ]
            }
        ],
        /* ... */
    }
}
```

Note: all output is minified by having all nonessential spaces removed.