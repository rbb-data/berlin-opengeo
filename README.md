berlin-opengeo
==============

An Open Source geocoder for Berlin based on the data published [here](http://datenjournalist.de/strassen-und-hausnummern-in-berlin-mit-geokoordinaten-als-open-data/).

## Installation

``` bash
$ git clone git@github.com:g-div/berlin-opengeo.git
$ cd berlin-opengeo
$ chmod +x setup.sh
$ ./setup.sh
$ npm install
```

## Start

``` bash
$ npm start
```

## Environment Variables

The Api is configurable via the following environment variables (the values below are the default values):

```
PORT = 9000                                     # HTTP Port
DB_URL = 'mongodb://localhost:21017/geocoder'   # MongoDB URI String
DB_COLLECTION = 'data'                          # MongoDB collection name
QUERY_LIMIT = 0                                 # Max results returned by a query (0 = infinite)
```

### Requirements:
- **~2 GB** of **FREE SPACE**
- bz2
- ruby
- MongoDB
- Node.js
- npm

Built on top of [apibox](https://github.com/g-div/apibox)
