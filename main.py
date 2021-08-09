from notion.client import NotionClient
from notion.space import Space
import os
import sys
import json

try:
    TOKEN = os.environ['NOTION_TOKEN_V2']
except Exception as err:
    raise RuntimeError(
        'NOTION_TOKEN_V2 environment variable must be defined.') from err

# instantiate new notion client
client = NotionClient(token_v2=TOKEN)
user_id = client.current_user.id


def sync_record_values(table, id):
    res = client.post('syncRecordValues', {
        'requests': [{
            "pointer": {
                "table": table,
                "id": id
            },
            "version": -1
        }]
    }).json()
    print(res)


# NOTE This is somewhat just for dev... it makes sense in prod but I have no
# tests, so no gaurantees that it will actually work as expected.
cache = {}


# Given that the root is such a grab back of stuff I suspect it is more likely to change than some of the other routes
def get_root(force=False):
    if 'getSpaces' in cache and not force:
        return cache['getSpaces']

    res = client.post('getSpaces', {}).json()
    root = res[user_id]
    cache['getSpaces'] = root

    return root


def get_pages(root):
    pages = [
        v['value'] for _, v in root['block'].items()
        if v['value']['type'] == 'page'
    ]
    return pages


def get_in(d, key_path, not_found=None):
    result = d

    for k in key_path:
        if k in result:
            result = result[k]
        else:
            return not_found

    return result


def format_page(page):
    try:
        title = page['properties']['title']
    except KeyError:
        title = None

    try:
        icon = page['format']['page_icon']
    except KeyError:
        icon = None

    try:
        last_edited_time = page['last_edited_time']
    except KeyError:
        last_edited_time = None

    return {'title': title, 'icon': icon, 'last_edited_time': last_edited_time}


def get_spaces(root, force=False):
    xs = root['user_root'][user_id]['value']['space_view_pointers']
    space_ids = [x['spaceId'] for x in xs]

    if 'getPublicSpaceData' in cache and not force:
        return cache['getPublicSpaceData']

    res = client.post('getPublicSpaceData', {
        'spaceIds': space_ids,
        'type': 'space-ids'
    }).json()
    xs = res['results']
    cache['getPublicSpaceData'] = xs
    return xs


# def get_space_ids():
#     res = client.post(
#         'syncRecordValues', {
#             'requests': [{
#                 "pointer": {
#                     "table": "user_root",
#                     "id": user_id
#                 },
#                 "version": -1
#             }]
#         }).json()
#     xs = res['recordMap']['user_root'][user_id]['value']['space_view_pointers']
#     space_ids = [x['spaceId'] for x in xs]
#     return space_ids


def main():
    print('Authenticated as:', client.current_user.email, file=sys.stderr)
    # sync_record_values("user_root", client.current_user.id)

    print('Spaces:')
    for x in get_spaces():
        print(x['id'], x['name'])


# if the module was called directly
if __name__ == '__main__':
    main()