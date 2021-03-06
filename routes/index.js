var express = require('express');
var router = express.Router();
var moment = require('moment');
var ObjectId = require('mongodb').ObjectId;
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var nodemailer = require('nodemailer');
var getrequest = require('request');

var db = require('../db');
var emailCredentials = require('../config/email');
var Thesis = require('../models/thesis');
var User = require('../models/user');
var Request = require('../models/request');

var emailaddress = emailCredentials.email;
var password = emailCredentials.password;

router.use(bodyParser.urlencoded({ extended: true }));
router.use(methodOverride(function(req, res){
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        // look in urlencoded POST bodies and delete it
        var method = req.body._method;
        delete req.body._method;
        return method
    }
}));

/* GET home page. */
router.get('/', function(req, res, next) {
	//var collection = db.get().collection('theses');
	Thesis.find({department: req.user.department})
		.sort({added: -1})
		.limit(3).exec(function(e, entry){
		  console.log(entry);
		  res.render('index', { title: 'Home', entries: entry,
		  						user: req.user, moment: moment});
	});
});

router.get('/admin', function(req, res, next){
	if(req.user.type == 'admin'){
		User.find({department: req.user.department}).sort({_id: -1}).exec(function(e, entry){
			res.render('admin/admin_users', {title: 'Users', entries: entry});
		});
	} else {
		res.redirect('/');
	}
});

router.get('/admin/collections', function(req, res, next){
	if(req.user.type == 'admin'){
		Thesis.find({department: req.user.department}).sort({_id: -1}).exec(function(e, entry){
			res.render('admin/admin_users', {title: 'Collection', entries: entry});
		});
	} else {
		res.redirect('/');
	}
});

router.get('/admin/add', function(req, res, next){
	if(req.user.type == 'admin'){
		Request.find({type: 'add', 'details.department': req.user.department}).sort({_id: -1}).exec(function(e, entry){
			res.render('admin/admin_users', {title: 'Add', entries: entry});
		});
	} else {
		res.redirect('/');
	}
});

router.get('/admin/edit', function(req, res, next){
	if(req.user.type == 'admin'){
		Request.find({type: 'edit', 'details.department': req.user.department}).sort({_id: -1}).exec(function(e, entry){
			res.render('admin/admin_users', {title: 'Edit', entries: entry});
		});
	} else {
		res.redirect('/');
	}
});

router.get('/admin/edit/compare/:itemid', function(req, res, next){
	if(req.user.type == 'admin'){
		var itemid = req.params.itemid;
		var editVal;
		var origVal;
		var username;
		Request.findOne({'_id': ObjectId(itemid)}, 'details username').exec(function(e, entry){
			if(e){
				req.flash('error_msg', 'Could not find request.');
				console.log('Request not found');
				next();
			}

			if(req.user.department === entry.details.department){
				editVal = entry.details;
				username = entry.username;
				console.log('requestfind: ' + editVal);
				Thesis.findOne({'_id': ObjectId(entry.details.id)}).exec(function(e, result){
					if(e){
						req.flash('error_msg', 'Could not find thesis entry.');
						console.log('Thesis entry not found');
						next();
					}
					origVal = result;
					console.log('thesisfind: ' + origVal);

					res.render('admin/edit_compare', {title: 'Edit', old: origVal, edit: editVal, username: username, itemid: itemid});
				})
			} else {
				res.redirect('/admin/edit')
				req.flash('error_msg', 'Access denied!')
			}
		})
		
	} else {
		res.redirect('/');
	}
});

router.get('/admin/delete', function(req, res, next){
	if(req.user.type == 'admin'){
		Request.find({type: 'delete', department: req.user.department}).sort({_id: -1}).exec(function(e, entry){
			res.render('admin/admin_users', {title: 'Delete', entries: entry});
		});
	} else {
		res.redirect('/');
	}
});

router.post('/admin/add/:itemid', function(req, res, next){
	var action = req.body.btn;
	var itemid = req.params.itemid;
	if(action=="accept"){
		Request.find({'_id': ObjectId(itemid)}, 'details createdAt username', function(e, result){
			if(!result.length && !e){
				req.flash('error_msg', 'Could not find add request.');
			} else if(result.length && !e) {
				//var result = Request.findRequest({'_id':itemid});
				console.log(result);
				var data = new Thesis({
					_id : ObjectId(itemid),
					department: result[0].details.department,
					thesis : result[0].details.thesis,
					subtitle : result[0].details.subtitle,
					description : result[0].details.description,
					year : result[0].details.year,
					tags : result[0].details.tags,
					members : result[0].details.members,
					advisers : result[0].details.advisers,
					fileURL : result[0].details.fileURL,
					fileHandle : result[0].details.fileHandle,
					fileType : result[0].details.fileType,
					images : result[0].details.images,
					youtube : result[0].details.youtube,
					added : result[0].createdAt,
					updated : result[0].createdAt,
					uploadedBy: result[0].username
				});
				console.log('Thesis entry added.');
				data.save();
				req.flash('success_msg', 'Thesis entry added successfully.');
				
				// Email User
				User.findOne({'username': result[0].username}, function(err, search){
					var transporter = nodemailer.createTransport('SMTP', {
						service : 'Gmail',
						auth : {
							user : emailaddress,
							pass : password
						}
					});
					var mailOptions = {
						from : 'Thesis IT <'+emailaddress+'>',
						to : search.email,
						subject : 'Thesis IT - Add thesis entry',
						text : 'Your request to add a new thesis entry was approved by admin. Title: ' +result[0].details.thesis+ '\nSubtitle: ' +result[0].details.subtitle+ '\nResearchers: ' +result[0].details.members+ '\nAdvisers: ' +result[0].details.advisers+'\nDescription: '+result[0].details.description,
						html : '<p>Your request to add a new thesis entry was approved by admin. </p><ul><li>Title: '+result[0].details.thesis+'</li><li>Subtitle: '+result[0].details.subtitle+'<li>Researchers: '+result[0].details.members+'</li><li>Advisers: '+result[0].details.advisers+'</li><li>Description: '+result[0].details.description+'</li></ul>'
					};

					transporter.sendMail(mailOptions, function(error, info) {
						if(error){
							console.log(error);
							req.flash('error_msg','Something went wrong in sending email to user.');
						} else {
							console.log('Message Sent: '+info.response);
						}
					});
				});
			} else {
				req.flash('error', e);
			}
		});
		Request.findOneAndRemove({'_id': ObjectId(itemid)}, function(e, entry){
			if(!e){
				console.log('Add request deleted');
			}
			return res.redirect('/admin/add');
		});
	} else {
		return res.redirect('/admin/add');
	}
});

router.delete('/admin/add/:itemid', function(req, res, next){
	var itemid = req.params.itemid;
	Request.remove({_id: itemid}).exec(function(e, entry){
		if(e){
			req.flash('error_msg', e);
			console.log('request not deleted')
			res.redirect('/admin/add');
		} else {
			req.flash('success_msg', 'Request deleted successfully.');
			console.log('success');
			res.redirect('/admin/add');
		}
	});
});

router.put('/admin/edit/:itemid', function(req, res, next){
	var requestId = req.params.itemid;
	Request.findOne({'_id':ObjectId(requestId)}, 'username details updatedAt', function(err, entry){
		if (err) {
			if (req.body.location === "compare"){
				res.send({ message : 'There was a problem in finding that particular request: ' + err});
			} else {
				res.send("There was a problem in finding that particular request: " + err);
			}
		} else {
			var dataToSave = {
				thesis : entry.details.thesis,
				subtitle : entry.details.subtitle,
				year : entry.details.year,
				description : entry.details.description,
				tags : entry.details.tags,
				members : entry.details.members,
				advisers : entry.details.advisers,
				fileURL : entry.details.fileURL,
				fileHandle : entry.details.fileHandle,
				fileType : entry.details.fileType,
				images : entry.details.images,
				youtube : entry.details.youtube,
				updated : entry.updatedAt
			};
			Thesis.findByIdAndUpdate(ObjectId(entry.details.id), dataToSave, function (err, result) {
				if(err) {
					if (req.body.location === "compare"){
						res.send({ message : 'There was a problem in updating that thesis entry: ' + err});
					} else {
						res.send('There was a problem in updating that thesis entry: ' + err);
					}
				} else {
					Request.findOneAndRemove({'_id': ObjectId(requestId)}).exec();

					// Email User
					User.findOne({'username': entry.username}, function(err, search){
						var transporter = nodemailer.createTransport('SMTP', {
							service : 'Gmail',
							auth : {
								user : emailaddress,
								pass : password
							}
						});
						var mailOptions = {
							from : 'Thesis IT <'+emailaddress+'>',
							to : search.email,
							subject : 'Thesis IT - Edit thesis entry',
							text : 'Your request to edit a thesis entry was approved by admin. Title: ' +entry.details.thesis+ '\nSubtitle: ' +entry.details.subtitle+ '\nResearchers: ' +entry.details.members+ '\nAdvisers: ' +entry.details.advisers+'\nDescription: '+entry.details.description,
							html : '<p>Your request to edit a thesis entry was approved by admin. </p><ul><li>Title: '+entry.details.thesis+'</li><li>Subtitle: '+entry.details.subtitle+'<li>Researchers: '+entry.details.members+'</li><li>Advisers: '+entry.details.advisers+'</li><li>Description: '+entry.details.description+'</li></ul>'
						};

						transporter.sendMail(mailOptions, function(error, info) {
							if(error){
								console.log(error);
								if (req.body.location === "compare") {
									res.send({ message : 'Something went wrong in sending email to user.'});
								} else {
									req.flash('error_msg','Something went wrong in sending email to user.');
								}
							} else {
								console.log('Message Sent: '+info.response);
							}
						});
					});
					
					if (req.body.location === "compare") {
						res.send({ message : 'Thesis entry was successfully upadated.'});
					} else {
						req.flash('success_msg', 'Thesis entry was successfully updated.');
						res.redirect('/admin/edit');
					}
				}
      });
		}
	})
});

router.delete('/admin/edit/:itemid', function(req, res, next){
	var requestId = req.params.itemid;
	Request.findOneAndRemove({ '_id': ObjectId(requestId) },  function(err, entry) {
        if (err) {
            res.send("There was a problem deleting an entry to the database: " + err);
        } else {
        	req.flash('success_msg', 'Request was successfully deleted.')
            console.log('Item deleted');
            res.redirect('/admin/edit') ;
        }

    });
});

router.post('/admin/delete/:itemid', function(req, res, next){
	var action = req.body.btn;
	var itemid = req.params.itemid;
	var thesisid = req.body.thesisid;
	if(action=="accept"){
		Request.find({'_id': ObjectId(itemid)}, 'username details', function(e, entry){
			if(!entry.length && !e){
				req.flash('error_msg', 'Could not find delete request.');
				res.redirect('/admin/delete');
			}  else if(entry.length && !e){
				Thesis.remove({'_id': thesisid}, function(e, result){
					if(e){
						req.flash('error_msg', 'Thesis entry delete failed.');
						res.redirect('/admin/delete');
					}
				}).exec();
				Request.remove({ 'details.id' : thesisid}).exec();

				// Email User
				User.findOne({'username': entry[0].username}, function(err, search){
						var transporter = nodemailer.createTransport('SMTP', {
							service : 'Gmail',
							auth : {
								user : emailaddress,
								pass : password
							}
						});
						var mailOptions = {
							from : 'Thesis IT <'+emailaddress+'>',
							to : search.email,
							subject : 'Thesis IT - Delete thesis entry',
							text : 'Your request to delete a thesis entry was approved by admin. Title: ' +entry[0].details.thesis+ '\nSubtitle: '+entry[0].details.subtitle+ '\nResearchers: ' +entry[0].details.members+ '\nAdvisers: ' +entry[0].details.advisers+'\nDescription: '+entry[0].details.description,
							html : '<p>Your request to delete a thesis entry was approved by admin. </p><ul><li>Title: '+entry[0].details.thesis+'</li><li>Subtitle: '+entry[0].details.subtitle+'<li>Researchers: '+entry[0].details.members+'</li><li>Advisers: '+entry[0].details.advisers+'</li><li>Description: '+entry[0].details.description+'</li></ul>'
						};

						transporter.sendMail(mailOptions, function(error, info) {
							if(error){
								console.log(error);
								req.flash('error_msg','Something went wrong in sending email to user.');
							} else {
								console.log('Message Sent: '+info.response);
							}
						});
					});

				console.log('Thesis entry deleted');
				req.flash('success_msg', 'Thesis entry successfully deleted.');
				res.redirect('/admin/delete');
			} else if(e){
				req.flash('error', e);
				res.redirect('/admin/delete');
			}
		});	
	} else {
		res.redirect('/admin/delete');
	}
});

router.delete('/admin/delete/:itemid', function(req, res, next){
	var itemid = req.params.itemid;
	Request.remove({'_id': itemid}).exec(function(e, entry){
		if(e){
			console.log('request not deleted')
			if (req.body.location === "compare") {
				res.send({ message : 'Request delete failed. Error: '+err});
			} else {
				req.flash('error_msg', 'Request delete failed.');
				res.redirect('/admin/delete');
			}
		} else {
			console.log('success');
			if (req.body.location === "compare") {
				res.send({ message : 'Request deleted successfully.'});
			} else {
				req.flash('success_msg', 'Request deleted successfully.');
				res.redirect('/admin/delete');
			}
		}
	});
});

module.exports = router;
