# iredmail-cli (Go) / Rest API (Node)

[![CircleCI](https://circleci.com/gh/drlogout/iredmail-cli/tree/master.svg?style=svg)](https://circleci.com/gh/drlogout/iredmail-cli/tree/master)

## Table of contents

* [Table of contents](#table-of-contents)
* [Installation](#installation)
* [Overview](#overview)
    * Mailbox
    * Mailbox-alias
    * Forwarding
    * Alias
* [Commands](#commands)
    * [<em>mailbox</em>](#mailbox)
        * [<em>add [MAILBOX_EMAIL] [PLAIN_PASSWORD]</em>](#add-mailbox_email-plain_password)
        * [<em>delete [MAILBOX_EMAIL]</em>](#delete-mailbox_email)
        * [<em>info [MAILBOX_EMAIL]</em>](#info-mailbox_email)
        * [<em>list</em>](#list)
        * [<em>update [MAILBOX_EMAIL]</em>](#update-mailbox_email)
        * [<em>add-alias [ALIAS] [MAILBOX_EMAIL]</em>](#add-alias-alias-mailbox_email)
        * [<em>delete-alias [ALIAS_EMAIL]</em>](#delete-alias-alias_email)
    * [<em>forwarding</em>](#forwarding)
        * [<em>add [MAILBOX_EMAIL] [DESTINATION_EMAIL]</em>](#add-mailbox_email-destination_email)
        * [<em>delete [MAILBOX_EMAIL] [DESTINATION_EMAIL]</em>](#delete-mailbox_email-destination_email)
        * [<em>list</em>](#list-1)
    * [<em>domain</em>](#domain)
        * [<em>add [DOMAIN]</em>](#add-domain)
        * [<em>delete [DOMAIN]</em>](#delete-domain)
        * [<em>list</em>](#list-2)
        * [<em>add-alias [ALIAS_DOMAIN] [DOMAIN]</em>](#add-alias-alias_domain-domain)
        * [<em>delete-alias  [ALIAS_DOMAIN]</em>](#delete-alias--alias_domain)
        * [<em>add-catchall [DOMAIN] [DESTINATION_EMAIL]</em>](#add-catchall-domain-destination_email)
        * [<em>delete-catchall [DOMAIN] [DESTINATION_EMAIL]</em>](#delete-catchall-domain-destination_email)
    * [<em>alias</em>](#alias)
        * [<em>add [ALIAS_EMAIL]</em>](#add-alias_email)
        * [<em>delete [ALIAS_EMAIL]</em>](#delete-alias_email)
        * [<em>info [ALIAS_EMAIL]</em>](#info-alias_email)
        * [<em>list</em>](#list-3)
        * [<em>add-forwarding [ALIAS_EMAIL] [DESTINATION_EMAIL]</em>](#add-forwarding-alias_email-destination_email)
        * [<em>delete-forwarding [ALIAS_EMAIL] [DESTINATION_EMAIL]</em>](#delete-forwarding-alias_email-destination_email)
    * [<em>version</em>](#version)



## Installation

> The current version only supports the MariaDB version of IRedMail (1.6.0 - 1.8.x)

Download the appropriate binary from https://github.com/drlogout/iredmail-cli/releases/latest, untar the file and move the binary to e.g. `/usr/local/bin/iredmail-cli`. 

By default `iredmail-cli` expects a config file under `~/.my.cnf-vmailadmin`. This file is generated through the iRedMail installation. It's also possible to specify a config file with the `—config` flag.

The `.my.cnf-vmailadmin` file needs following variables:

```
[client]
host=127.0.0.1 (optional, default 127.0.0.1)
port=3306 (optional, default 3306)
user=vmailadmin
password="UXXjQYn3KLbAJhonbkmNyGNJRsoXZ4rn"
```



## Overview

**Mailbox**

What is called `user` in iRedMail is a `mailbox` in the iredmail-cli terminology. I don't know if this is a good idea, but for me user feels wrong.

```
iRedMail: 
	info@example.com = user
iredmail-cli:
	info@example.com = mailbox
```
See [<em>mailbox</em>](#mailbox)

**Mailbox-alias**

A mailbox can have additional email addresses:

![doc-mailbox-alias](assets/doc-mailbox-alias.png)

All emails sent to the addresses `post@example.com` and `hello@example.com` will be delivered to the same mailbox `info@example.com`.

Emails can now also be sent with  `post@example.com` and `hello@example.com` as sender.

See [<em>mailbox add-alias [ALIAS] [MAILBOX_EMAIL]</em>](#add-alias-alias-mailbox_email)

**Forwarding**

Mails can be forwarded from a mailbox:

![doc-forwarding](assets/doc-forwarding.png)

All emails sent to the mailbox `info@example.com` will also be delivered to the addresses `tech@company.com` and `support@example.net`.

See [<em>forwarding</em>](#forwarding)

**Alias**

If no mailbox is required, an alias can be used to forward emails to other addresses:

![doc-alias](assets/doc-alias.png)

Multiple destination addresses are possible.

[<em>alias</em>](#alias)



## Commands

To print the help of a command or sub command append the `—help` or `-h` flag.

------

### *mailbox*

Add/delete/list mailboxes and mailbox-aliases.

#### *add \[MAILBOX_EMAIL] \[PLAIN_PASSWORD]*

Add a new mailbox.<br/>
*Example:*

```bash
$ iredmail-cli mailbox add info@example.com swekjhlwekjdhw
```

*Flags:*<br/>
-q, --quota: Set custom quota in MB, default 2048<br/>
-s, --storage-path: Set custom storage path

#### *delete \[MAILBOX_EMAIL]*

Delete a mailbox.<br/>
*Example:*

```bash
$ iredmail-cli mailbox delete info@example.com
```
*Flags:*<br/>
-f, --force: Force deletion

#### *info \[MAILBOX_EMAIL]*

Show mailbox info.<br/>
*Example:*

```bash
$ iredmail-cli mailbox info info@example.com
+----------------------+---------------------------------------------+
|       MAILBOX        |              info@example.com               |
+----------------------+---------------------------------------------+
| Quota                | 2048 MB                                     |
| Maildir              | example.com/i/n/f/info-2018.07.09.09.13.27/ |
+----------------------+---------------------------------------------+
```
#### *list*

List mailboxes.<br/>
*Example:*

```bash
$ iredmail-cli mailbox list
+-----------------------+------------+
|        MAILBOX        | QUOTA (MB) |
+-----------------------+------------+
| info@domain.com       |       2048 |
| info@example.com      |       2048 |
| mail@example.net      |       2048 |
| support@example.com   |       2048 |
+-----------------------+------------+

# To filter results use the --filter flag
$ iredmail-cli mailbox list -f example.com
+-----------------------+------------+
|        MAILBOX        | QUOTA (MB) |
+-----------------------+------------+
| info@example.com      |       2048 |
| support@example.com   |       2048 |
+-----------------------+------------+
```

*Flags:*<br/>
-f, --filter: Filter results

#### *update \[MAILBOX_EMAIL]*

Update keep-copy and quota.<br/>
*keep-copy:* If mailboxes with forwardings should not keep a copy of the forwarded email use "--keep-copy no".<br/>
This is only possible if at least one forwarding for [MAILBOX_EMAIL] exists.<br/>
By default copies are kept in the mailbox.<br/>
*quota:* The quota of the mailbox could be set with this flag, e.g. "--quota 4096" (in MB).<br/>
*Example:*

```bash
$ iredmail-cli mailbox update info@example.com -k no
$ iredmail-cli mailbox update info@example.com -q 4098
```
*Flags:*<br/>
-k, --keep-copy: enable or disable keep-copy<br/>
-q, --quota: Set custom quota in MB

#### *add-alias [ALIAS] \[MAILBOX_EMAIL]*

Add a mailbox alias.<br/>
A mailbox `info@example.com` can have additional email addresses like `abuse@example.com`, `webmaster@example.com` and more, all emails sent to these addresses will be delivered to the same mailbox (`info@example.com`). Emails can now also be sent with those addresses as sender.<br/>
*Example:*

```bash
$ iredmail-cli mailbox add-alias abuse info@example.com
$ iredmail-cli mailbox add-alias webmaster info@example.com
$ iredmail-cli mailbox info info@example.com
+----------------------+---------------------------------------------+
|       MAILBOX        |              info@example.com               |
+----------------------+---------------------------------------------+
| Quota                | 2048 MB                                     |
| Mailbox aliases      | abuse                                       |
|                      | webmaster                                   |
| Maildir              | example.com/i/n/f/info-2018.07.09.09.13.27/ |
+----------------------+---------------------------------------------+
```

#### *delete-alias [ALIAS_EMAIL]*

Delete an alias.<br/>
*Example:*

```bash
$ iredmail-cli mailbox delete-alias abuse@example.com
```
------

### *forwarding*

Add/delete/list forwardings.

#### *add \[MAILBOX_EMAIL] [DESTINATION_EMAIL]*

Add forwarding.<br/>
*Example:*

```bash
$ iredmail-cli forwarding add info@example.com post@otherdomain.com
$ iredmail-cli forwarding add info@example.com tech@company.com
$ iredmail-cli mailbox info info@example.com
+----------------------+---------------------------------------------+
|       MAILBOX        |              info@example.com               |
+----------------------+---------------------------------------------+
| Quota                | 2048 MB                                     |
| Mailbox aliases      | abuse                                       |
|                      | webmaster                                   |
| Forwardings          | tech@company.com                            |
|                      | post@otherdomain.com                        |
| Keep copy in mailbox | yes                                         |
| Maildir              | example.com/i/n/f/info-2018.07.09.09.13.27/ |
+----------------------+---------------------------------------------+

```

By default a copy will be left in the mailbox, to change that behavior use the `iredmail-cli mailbox update` command.

#### *delete \[MAILBOX_EMAIL] [DESTINATION_EMAIL]*

Delete forwarding.<br/>
*Example:*

```bash
$ iredmail-cli forwarding delete info@example.com tech@company.com
```

#### *list*

List forwardings.<br/>
*Example:*

```bash
$ iredmail-cli forwarding list
+------------------+----------------------------+----------------------+
|  MAILBOX EMAIL   |     DESTINATION EMAIL      | KEEP COPY IN MAILBOX |
+------------------+----------------------------+----------------------+
| info@example.com | tech@company.com           | yes                  |
|                  | post@otherdomain.com       |                      |
| mail@example.net | mail@domain.com            | no                   |
+------------------+----------------------------+----------------------+
```

*Flags:*<br/>
-f, --filter: Filter results

------

### *domain*

Add/delete/list domains, domain aliases and catchall forwardings.

#### *add [DOMAIN]*

Add a domain.<br/>
*Example:*

```bash
$ iredmail-cli domain add somedomain.com
```

*Flags:*<br/>
-d, --description: Domain description<br/>
-s, --settings: Domain settings (default: default_user_quota:2048)

#### *delete [DOMAIN]*

Delete a domain.<br/>
*Example:*

```bash
$ iredmail-cli domain delete somedomain.com
```

*Flags:*<br/>
-f, --force: Force deletion

#### *list*

List domains.<br/>
*Example:*

```bash
$ iredmail-cli domain list
+-------------+-----------+-------------------+-------------+
|   DOMAIN    |   ALIAS   | CATCH-ALL ADDRESS | DESCRIPTION |
+-------------+-----------+-------------------+-------------+
| domain.com  |           |                   |             |
| example.com |           |                   |             |
+-------------+-----------+-------------------+-------------+
```

*Flags:*<br/>
-f, --filter: Filter results

#### *add-alias \[ALIAS_DOMAIN] \[DOMAIN]*

Add an alias domain.<br/>
Emails sent to user@[ALIAS_DOMAIN] will be delivered to user@[DOMAIN].<br/>
*Example:*<br/>

```bash
$ iredmail-cli domain add-alias domain.net domain.com
$ iredmail-cli domain list
+-------------+------------+-------------------+-------------+
|   DOMAIN    |   ALIAS    | CATCH-ALL ADDRESS | DESCRIPTION |
+-------------+------------+-------------------+-------------+
| domain.com  | domain.net |                   |             |
| example.com |            |                   |             |
+-------------+------------+-------------------+-------------+
```

#### *delete-alias  \[ALIAS_DOMAIN]*

Delete an alias domain.<br/>
*Example:*

```bash
$ iredmail-cli domain delete-alias [ALIAS_DOMAIN]
```

#### *add-catchall \[DOMAIN] \[DESTINATION_EMAIL]*

Add a per-domain catch-all forwarding.<br/>
Emails sent to non-existing mailboxes of [DOMAIN] will be delivered to [DESTINATION_EMAIL].<br/>
Multiple [DESTINATION_EMAIL]s are possible.<br/>
*Example:*

```bash
$ iredmail-cli domain add-catchall example.com info@example.com
$ iredmail-cli domain add-catchall example.com post@otherdomain.com

$ iredmail-cli domain list
+-------------+------------+----------------------+-------------+
|   DOMAIN    |   ALIAS    | CATCH-ALL ADDRESS    | DESCRIPTION |
+-------------+------------+----------------------+-------------+
| domain.com  | domain.net |                      |             |
| example.com |            | info@example.com     |             |
|             |            | post@otherdomain.com |             |
+-------------+------------+----------------------+-------------+
```

#### *delete-catchall \[DOMAIN] \[DESTINATION_EMAIL]*

Delete a per-domain catch-all forwarding.<br/>
*Example:*

```bash
$ iredmail-cli domain delete-catchall example.com post@otherdomain.com
```

------

### *alias*

Add/delete/list aliases and their forwardings.

#### *add [ALIAS_EMAIL]*

Add an alias.<br/>
Emails sent to [ALIAS_EMAIL] will be delivered to alias forwardings.<br/>
Use the "alias add-forwarding" command to add forwardings to the alias.<br/>
An alias can have multiple forwardings.<br/>
*Example:*

```bash
$ iredmail-cli alias add tech@example.com
```

#### *delete [ALIAS_EMAIL]*

Delete an alias.<br/>
*Example:*

```bash
$ iredmail-cli alias delete tech@example.com
```

*Flags:*<br/>
-f, --force: Force deletion

#### *info [ALIAS_EMAIL]*

Show alias info.<br/>
*Example:*

```bash
$ iredmail-cli alias info tech@example.com
+--------------------+---------------------------+
|       ALIAS        |        FORWARDINGS        |
+--------------------+---------------------------+
| tech@example.com   | info@example.com          |
|                    | chris@example.com         |
|                    | pete@domain.com           |
+--------------------+---------------------------+
```

#### *list*

List aliases.<br/>
*Example:*

```bash
$ iredmail-cli alias list
+-----------------------+---------------------------+
|         ALIAS         |        FORWARDINGS        |
+-----------------------+---------------------------+
| tech@example.com      |                           |
| help@example.net      |                           |
+-----------------------+---------------------------+
```

*Flags:*<br/>
-f, --filter: Filter results

#### *add-forwarding \[ALIAS_EMAIL] \[DESTINATION_EMAIL]* 

Add forwarding to an alias.<br/>
Emails sent to [ALIAS_EMAIL] will be delivered to [DESTINATION_EMAIL].<br/>
An alias can have multiple forwardings.<br/>
*Example:*

```bash
$ iredmail-cli alias add tech@example.com info@exmaple.com
$ iredmail-cli alias add tech@example.com pete@domain.com

+-----------------------+---------------------------+
|         ALIAS         |        FORWARDINGS        |
+-----------------------+---------------------------+
| tech@example.com      | info@exmaple.com          |
|                       | pete@domain.com           |
+-----------------------+---------------------------+
```

#### *delete-forwarding \[ALIAS_EMAIL] \[DESTINATION_EMAIL]*

Delete forwarding from an alias.<br/>
*Example:* 

```bash
$ iredmail-cli alias delete tech@example.com pete@domain.com 
```

------

### *version*

Show iredMail and iredmail-cli version.

*Example:*

```bash
$ iredmail-cli version
cli version: 0.2.5
iredMail version (MariaDB): 0.9.8
```

------

### *iredmail-cli-test*

Run end-to-end smoke tests against your iRedMail instance using the `iredmail-cli-test` binary.

`iredmail-cli-test` uses `iredmail-cli` commands and relies on the same default config file:
`~/.my.cnf-vmailadmin`

*Usage:*

```bash
$ iredmail-cli-test --domain example.com
```

*Optional flags:*
`--cli` path to `iredmail-cli` binary (default `iredmail-cli`)<br/>
`--proof-cli` path to CLI used for list/proof checks (default `iredmail-cli`)<br/>
`--quiet` hide per-step pass markers (default `false`)

*Tests performed:*
- Create 2 random mailboxes
- Update both mailboxes (password and quota)
- Add 2 random forwardings per mailbox
- Edit forwardings by deleting 1 forwarding and adding a replacement
- Remove all created forwardings
- Verify no forwardings remain
- Remove both created mailboxes
- Verify both mailboxes are removed

------

### *REST API (Node.js)*

A Node.js REST API wrapper is available at:
`tools/rest-api`

It executes `iredmail-cli` commands on the server and returns command output as JSON.

**Warning:** This API has no authentication or authorization. Never expose it to the public internet under any circumstances. Bind it to localhost or protect it behind a trusted private network and strong access controls.

Covered command groups and operations:
- `mailbox`: `add`, `delete`, `info`, `list`, `update`, `add-alias`, `delete-alias`
- `forwarding`: `add`, `delete`, `list`
- `alias`: `add`, `delete`, `info`, `list`, `add-forwarding`, `delete-forwarding`

*Source files:*
- `tools/rest-api/server.js`
- `tools/rest-api/package.json`

*Run:*

```bash
cd tools/rest-api
npm start
```

Optional environment variables:
- `PORT` (default `8080`)
- `IREDMAIL_CLI_PATH` (default `iredmail-cli`)
- `CLI_TIMEOUT_MS` (default `15000`)

Timeout behavior:
- If an `iredmail-cli` command exceeds `CLI_TIMEOUT_MS`, the API kills the process and returns HTTP `504`.
- Response body on timeout:
  - `error`: `cli command timed out`
  - `timeout_ms`: configured timeout
  - `args`: command arguments used

*API examples:*

```bash
# Health
curl http://127.0.0.1:8080/health

# Version
curl http://127.0.0.1:8080/api/version

# List mailboxes
curl "http://127.0.0.1:8080/api/mailboxes?filter=example.com"

# Add mailbox
curl -X POST http://127.0.0.1:8080/api/mailboxes \
  -H "Content-Type: application/json" \
  -d '{"email":"api-test@example.com","password":"StrongPass123456","quota":2048}'

# Delete mailbox
curl -X DELETE http://127.0.0.1:8080/api/mailboxes/api-test%40example.com

# Update mailbox (quota/password/keepCopy)
curl -X PATCH http://127.0.0.1:8080/api/mailboxes/api-test%40example.com \
  -H "Content-Type: application/json" \
  -d '{"quota":4096,"password":"NewStrongPass123!","keepCopy":false}'

# Add forwarding
curl -X POST http://127.0.0.1:8080/api/forwardings \
  -H "Content-Type: application/json" \
  -d '{"mailboxEmail":"api-test@example.com","destinationEmail":"ops@example.net"}'

# Delete forwarding
curl -X DELETE http://127.0.0.1:8080/api/forwardings \
  -H "Content-Type: application/json" \
  -d '{"mailboxEmail":"api-test@example.com","destinationEmail":"ops@example.net"}'

# Alias add / info / delete
curl -X POST http://127.0.0.1:8080/api/aliases \
  -H "Content-Type: application/json" \
  -d '{"aliasEmail":"alias-test@example.com"}'
curl http://127.0.0.1:8080/api/aliases/alias-test%40example.com
curl -X DELETE http://127.0.0.1:8080/api/aliases/alias-test%40example.com
```
