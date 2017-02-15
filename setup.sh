#!/bin/bash
set -e

# if your mongodb stores data in a folder with to few memory, please chose another one using:
# mongod --dbpath /lot/of/freespace
FREE=$(df -h ./ | grep -vE '^Filesystem|tmpfs'| awk '{ print $4 }' | sed 's/Gi//' | sed 's/G//')
if [ $FREE -lt 5 ]; then
	echo "There are less than 5 GB freespace"
	echo "Please choose another mongopath:"
	echo "mongod --dbpath /lot/of/freespace"
fi

# get field names from one csv, import data via stream
# conversion recipe inspired by https://thedatachef.blogspot.de/2011/01/convert-tsv-to-json-command-line.html
echo "Converting data.tsv.bz2 to json"
export FIELDS=$(cat ../data/headers_data.tsv | head -n 1 | sed $'s/\t/,/g')
bzip2 -d ../data/data.tsv.bz2 --stdout \
  | ruby -rjson -ne 'puts ENV["FIELDS"].split(",").zip($_.strip.split("\t")).inject({}){|h,x| h[x[0]]=x[1];h}.to_json' \
  | mongoimport --db geocoder --collection data

echo "Done!"
