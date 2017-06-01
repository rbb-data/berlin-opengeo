#!/bin/bash
set -uxe

# for config
DB_HOST="localhost"
DB_PORT="27017"
DB_NAME="geocoder"
DB_COLLECTION="data"

###
# !! you shouldn't need to touch anything below !!
##

DB_URL="mongodb://$DB_HOST:$DB_PORT/$DB_NAME"

# if your mongodb stores data in a folder with to few memory, please chose another one using:
# mongod --dbpath /lot/of/freespace
FREE=$(df -h ./ | grep -vE '^Filesystem|tmpfs'| awk '{ print $4 }' | sed 's/Gi//' | sed 's/G//')
if [ "$FREE" -lt 5 ]; then
	echo "There is less than 5 GB freespace"
	echo "Please choose another mongopath:"
	echo "mongod --dbpath /lot/of/freespace"
fi

# get field names from one csv, import data via stream
# conversion recipe inspired by https://thedatachef.blogspot.de/2011/01/convert-tsv-to-json-command-line.html
echo "→ Importing data.tsv.bz2 into the database"
export FIELDS=$(cat ../data/headers_data.tsv | head -n 1 | sed $'s/\t/,/g')
bzcat ../data/data.uniq.tsv.bz2 \
 | ruby -rjson -ne 'puts ENV["FIELDS"].split(",").zip($_.strip.split("\t")).inject({}){|h,x| h[x[0]]=x[1];h}.to_json' \
 | mongoimport --host "$DB_HOST" --port "$DB_PORT" --db "$DB_NAME" --collection "$DB_COLLECTION"

echo "→ Creating indices"
CREATE_INDICES="
  db.data.createIndex({ bezirk: 1 })
  db.data.createIndex({ ortsteil: 1 })
  db.data.createIndex({ str_hnr: 1 })
  db.data.createIndex({ strasse: 1 })
  db.data.createIndex({ plz: 1 })
"
mongo "$DB_URL" --eval "$CREATE_INDICES"

echo "→ Converting latitude and longitude"
CONVERT_LATLON="
  // bulk'd latitude longitude conversion
  var bulkOps = []

  db.data.find().forEach(function (doc) {
    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          \$set: {
            lat: +(doc.lat),
            lon: +(doc.lon)
          }
        }
      }
    })
  })

  db.data.bulkWrite(bulkOps)
"
mongo "$DB_URL" --eval "$CONVERT_LATLON"

echo "→ Done!"
