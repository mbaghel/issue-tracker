/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var ObjectId = require('mongodb').ObjectID;
var sanitizeHtml = require('sanitize-html');

const CONNECTION_STRING = process.env.DB; 
// connect to mongo server and get collection
var issueDb;

MongoClient.connect(CONNECTION_STRING, function(err, db) {
  if (err) {
    console.log(err.message)
  }
  issueDb = db
})
                    
module.exports = function (app) {

  app.route('/api/issues/:project')
  
    // get project issues which match query
    .get(async function (req, res){
      var project = req.params.project;
      const filters = req.query
      // create a query object for db search
      let queryObj = {}
      for (let filter in filters) {
        if (filters.hasOwnProperty(filter)) {
          let value;
          // parse strings in special cases
          if (filter === '_id') {
            try {value = new ObjectId(filter._id)}
            catch(err) {return res.send(`Invalid id: ${filter._id}`)}
          } else if (filter === 'open') {
            value = filters[filter] === 'true' ? true: false 
          } else {
            value = filters[filter]
          }
          queryObj[filter] = value
        }
      }
      try {
        const documents = await issueDb.collection(project).find(queryObj).toArray()
        
        const sanitized = documents.map(doc => {
          const san = {...doc}
          san.issue_title = sanitizeHtml(doc.issue_title)
          san.issue_text = sanitizeHtml(doc.issue_text)
          san.created_by = sanitizeHtml(doc.created_by)
          san.assigned_to = sanitizeHtml(doc.assigned_to)
          san.status_text = sanitizeHtml(doc.status_text)
          return san
        })
        
        res.send(sanitized)
      }
      catch(err) {
        console.error(err)
        res.status(500).send("Internal server error")
      }
    })
    
    // add a new issue and return it
    .post(async function (req, res){
      var project = req.params.project;
      var {issue_title,issue_text,created_by,assigned_to,status} = req.body
      if (!issue_title || !issue_text || !created_by) return res.status(500).send('Missing required field');
      try {
        var result = await issueDb.collection(project).insertOne({
        issue_title,
        issue_text,
        created_by,
        assigned_to: assigned_to || '',
        status_text: status || '',
        updated_on: new Date(),
        created_on: new Date(),
        open: true
        })
        res.send(result.ops[0])
      }
      catch(err) {
        console.log(err)
        res.status(500).send("Internal server error")
      }
    })
    
    // update an issue
    .put(async function (req, res){
      var project = req.params.project;
      const bodyObj = req.body
      if (!bodyObj._id) return res.send('please enter an _id')
      let updateId;
      try {updateId = new ObjectId(bodyObj._id)}
      catch(err) {return res.send(`could not update ${bodyObj._id}`)}
    
      let updateObj = {}
      for (let field in bodyObj) {
        if (bodyObj.hasOwnProperty(field)) {
          if (bodyObj[field] !== '' && field !== '_id') {
            if (field === 'open') {
              updateObj[field] = bodyObj[field] === 'true' ? true: false
            } else {
              updateObj[field] = bodyObj[field]
            }
          }
        }
      }
      if (!Object.keys(updateObj).length) return res.send('no updated field sent')
      //updateObj.updated_on = new Date()
      
      try {
        const result = await issueDb.collection(project).update(
          { _id: updateId },
          { $currentDate: { updated_on: true },
            $set: updateObj
          }
        )
        if (result.nModified === 0) {
          return res.send('could not update ' + updateObj._id)
        }
      }
      catch(err) {
        console.error(err)
        res.status(500).send('Internal server error')
      }
      res.send('successfully updated')
    })
    
    // delete an issue
    .delete(async function (req, res){
      var project = req.params.project;
      if (!req.body._id) return res.send('_id error')
    
      let deleteId;
      try {deleteId = new ObjectId(req.body._id)}
      catch(err) {return res.send(`could not delete ${req.body._id}`)}
    
      const result = await issueDb.collection(project).deleteOne({ _id: deleteId })
    
      res.send('deleted ' + req.body._id)
    });
    
};