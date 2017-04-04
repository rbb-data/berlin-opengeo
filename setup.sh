#!/bin/bash
set -uxe

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
 | mongoimport --port 21080 --db geocoder --collection data

echo "→ Creating indices"
CREATE_INDICES="
  db.data.createIndex({ bezirk: 1 })
  db.data.createIndex({ ortsteil: 1 })
  db.data.createIndex({ str_hnr: 1 })
  db.data.createIndex({ strasse: 1 })
  db.data.createIndex({ plz: 1 })
"
mongo localhost:21080/geocoder --eval "$CREATE_INDICES"

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
mongo localhost:21080/geocoder --eval "$CONVERT_LATLON"

echo "→ Done!"
